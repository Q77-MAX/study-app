import Dexie, { type Table } from 'dexie';
import type { Question, WrongRecord, NoteAnnotation, PracticeSession, AppSettings, QuestionBank } from '../types';
import { defaultAppSettings } from '../types';
import { v4 as uuidv4 } from 'uuid';

let currentAccountId: string | null = null;

export function setDBAccount(accountId: string | null) {
  currentAccountId = accountId;
  // 重建 db 实例
  rebuildDB();
}

function getDBName() {
  return currentAccountId ? `StudyAppDB_${currentAccountId}` : 'StudyAppDB';
}

export class StudyDB extends Dexie {
  questions!: Table<Question, string>;
  wrongRecords!: Table<WrongRecord, string>;
  notes!: Table<NoteAnnotation, string>;
  sessions!: Table<PracticeSession, string>;
  settings!: Table<{ key: string; value: any }, string>;
  banks!: Table<QuestionBank, string>;

  constructor(dbName?: string) {
    super(dbName || getDBName());
    // 版本 1（旧版，会被升级清除）
    this.version(1).stores({
      questions: 'id, type, mastery, lastPracticed, *knowledgePoints',
      wrongRecords: 'id, questionId, timestamp, reviewed',
      notes: 'id, questionId',
      sessions: 'id, mode, startTime',
      settings: 'key',
    });
    // 版本 2：增加题库分组
    this.version(2).stores({
      questions: 'id, type, mastery, lastPracticed, batchId, *knowledgePoints',
      wrongRecords: 'id, questionId, timestamp, reviewed',
      notes: 'id, questionId',
      sessions: 'id, mode, startTime',
      settings: 'key',
      banks: 'id, createdAt',
    }).upgrade(async (tx) => {
      // 清理旧数据，避免 schema 不兼容
      await tx.table('questions').clear();
      await tx.table('wrongRecords').clear();
      await tx.table('notes').clear();
      await tx.table('sessions').clear();
    });
  }
}

let dbInstance: StudyDB | null = null;

function rebuildDB() {
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = new StudyDB();
}

// 初始化
rebuildDB();

export function getDB(): StudyDB {
  if (!dbInstance) rebuildDB();
  return dbInstance!;
}

// 兼容旧代码：db 作为 getter
export const db = new Proxy({} as StudyDB, {
  get(_, prop) {
    return (getDB() as any)[prop];
  },
  set(_, prop, value) {
    (getDB() as any)[prop] = value;
    return true;
  },
});

// ============ 题库管理 ============

export async function clearAllData(): Promise<void> {
  await db.questions.clear();
  await db.wrongRecords.clear();
  await db.notes.clear();
  await db.sessions.clear();
  await db.banks.clear();
}

export async function createBank(name: string): Promise<string> {
  const id = uuidv4();
  await db.banks.add({ id, name, questionCount: 0, createdAt: Date.now() });
  return id;
}

export async function getAllBanks(): Promise<QuestionBank[]> {
  return db.banks.orderBy('createdAt').reverse().toArray();
}

export async function deleteBank(bankId: string): Promise<void> {
  // 先查出题目ID，再逐个清理关联数据
  const qs = await db.questions.where('batchId').equals(bankId).toArray();
  for (const q of qs) {
    await db.wrongRecords.where('questionId').equals(q.id).delete();
    await db.notes.where('questionId').equals(q.id).delete();
  }
  await db.questions.where('batchId').equals(bankId).delete();
  await db.banks.delete(bankId);
}

export async function renameBank(bankId: string, name: string): Promise<void> {
  await db.banks.update(bankId, { name });
  // 同步更新所有题目的 batchName
  await db.questions.where('batchId').equals(bankId).modify({ batchName: name });
}

export async function updateBankCount(bankId: string): Promise<void> {
  const count = await db.questions.where('batchId').equals(bankId).count();
  await db.banks.update(bankId, { questionCount: count });
}

// ============ 题目操作 ============

export async function addQuestions(
  questions: Partial<Question>[],
  batchId: string,
  batchName: string,
  onProgress?: (imported: number, total: number) => void,
): Promise<number> {
  const now = Date.now();
  const items: Question[] = questions
    .filter((q) => q.content && q.content.trim())
    .map((q) => ({
      id: uuidv4(),
      type: q.type || 'single',
      content: q.content || '',
      options: q.options || [],
      answer: q.answer || '',
      explanation: q.explanation || '',
      knowledgePoints: q.knowledgePoints || [],
      difficulty: q.difficulty || 3,
      correctCount: 0,
      wrongCount: 0,
      lastPracticed: 0,
      mastery: 50,
      createdAt: now,
      batchId,
      batchName,
    }));

  const BATCH_SIZE = 50;
  let imported = 0;
  const total = items.length;
  onProgress?.(0, total);

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    try {
      await db.questions.bulkAdd(batch);
      imported += batch.length;
    } catch (e) {
      console.warn(`Batch ${i} failed, retrying individually...`, e);
      for (const item of batch) {
        try {
          await db.questions.add(item);
          imported++;
        } catch (singleErr) {
          console.warn(`Failed: ${item.content?.slice(0, 30)}`, singleErr);
        }
      }
    }
    onProgress?.(imported, total);
  }
  await updateBankCount(batchId);
  return imported;
}

export async function getAllQuestions(): Promise<Question[]> {
  return db.questions.toArray();
}

/** 修复已有题库数据：拆分合并选项、修正题型 */
export async function repairAllQuestions(): Promise<number> {
  const all = await db.questions.toArray();
  let fixed = 0;
  for (const q of all) {
    let changed = false;

    // 1. 拆分合并选项：支持 A. A、A) A）B. B、等所有格式
    const newOpts: string[] = [];
    for (const opt of q.options || []) {
      if (!opt || opt.length < 2) continue;
      // 策略1: 按 [字母][.、）)] 拆分
      let parts = opt.split(/(?=[A-Ha-h][\.\、）\)])/).filter(s => s.trim());
      // 策略2: 按 [空格/开头][字母][空格/标点] 拆分
      if (parts.length <= 1) parts = opt.split(/(?=\s[A-Ha-h][\s\.\、）\)])/);
      // 策略3: 按 [字母]直接跟中文 拆分（无分隔符情况 "A断路器B隔离开关"）
      if (parts.length <= 1) parts = opt.split(/(?=[A-Ha-h][一-龥])/);
      if (parts.length <= 1) parts = opt.split(/(?<=[一-龥])[A-Ha-h]/);
      // 策略4: 分号分隔
      if (parts.length <= 1) parts = opt.split(/[；;]/);
      for (const p of parts) {
        const cleaned = p.trim().replace(/^[A-Ha-h][\.\、）\)\s]+/, '').trim();
        if (cleaned) newOpts.push(cleaned);
      }
    }
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const o of newOpts) { if (!seen.has(o)) { seen.add(o); deduped.push(o); } }
    if (deduped.length !== (q.options || []).length || deduped.some((o, i) => o !== (q.options || [])[i])) {
      q.options = deduped;
      changed = true;
    }

    // 2. 多字母答案 → 多选题
    const ans = (q.answer || '').toUpperCase().replace(/[,，、;；\s]+/g, '').replace(/[^A-H]/g, '');
    if (q.type === 'single' && ans.length > 1) {
      q.type = 'multiple';
      changed = true;
    }

    // 3. 判断题答案标准化
    if (q.type === 'judge') {
      if (/^(对|正确|是|√|✓|T|TRUE)$/i.test(ans)) {
        if (q.answer !== 'A') { q.answer = 'A'; changed = true; }
      } else if (/^(错|错误|否|×|✗|F|FALSE)$/i.test(ans)) {
        if (q.answer !== 'B') { q.answer = 'B'; changed = true; }
      }
    }

    // 4. 多选答案排序
    if (q.type === 'multiple' && ans.length > 1 && /^[A-H]+$/.test(ans)) {
      const sorted = ans.split('').sort().join('');
      if (q.answer !== sorted) { q.answer = sorted; changed = true; }
    }

    // 5. 没有类型的题补默认值
    if (!q.type) { q.type = 'single'; changed = true; }

    if (changed) {
      await db.questions.put(q);
      fixed++;
    }
  }
  return fixed;
}

export async function getQuestionsByBank(bankId: string): Promise<Question[]> {
  return db.questions.where('batchId').equals(bankId).toArray();
}

export async function getQuestionCount(): Promise<number> {
  return db.questions.count();
}

export async function getPracticeQueue(count: number): Promise<Question[]> {
  const all = await db.questions.toArray();
  if (all.length === 0) return [];
  all.sort((a, b) => {
    if (a.mastery !== b.mastery) return a.mastery - b.mastery;
    return a.lastPracticed - b.lastPracticed;
  });
  return all.slice(0, Math.min(count, all.length));
}

export async function updateQuestionMastery(id: string, isCorrect: boolean): Promise<void> {
  const q = await db.questions.get(id);
  if (!q) return;
  const now = Date.now();
  let newMastery: number;
  if (isCorrect) {
    newMastery = q.mastery + (100 - q.mastery) * 0.15;
  } else {
    newMastery = q.mastery - q.mastery * 0.2;
  }
  newMastery = Math.max(0, Math.min(100, Math.round(newMastery)));
  await db.questions.update(id, {
    mastery: newMastery,
    correctCount: isCorrect ? q.correctCount + 1 : q.correctCount,
    wrongCount: isCorrect ? q.wrongCount : q.wrongCount + 1,
    lastPracticed: now,
  });
}

export async function deleteQuestion(id: string): Promise<void> {
  await db.questions.delete(id);
  await db.wrongRecords.where('questionId').equals(id).delete();
  await db.notes.where('questionId').equals(id).delete();
}

// ============ 错题操作 ============

export async function addWrongRecord(questionId: string, userAnswer: string): Promise<void> {
  await db.wrongRecords.add({
    id: uuidv4(),
    questionId,
    userAnswer,
    timestamp: Date.now(),
    reviewed: false,
  });
}

export async function getWrongRecords(): Promise<(WrongRecord & { question?: Question })[]> {
  const records = await db.wrongRecords.orderBy('timestamp').reverse().toArray();
  const results: (WrongRecord & { question?: Question })[] = [];
  for (const r of records) {
    const q = await db.questions.get(r.questionId);
    results.push({ ...r, question: q });
  }
  return results;
}

export async function getWrongQuestionsByType(): Promise<Record<string, Question[]>> {
  const records = await db.wrongRecords.toArray();
  const questionIds = [...new Set(records.map((r) => r.questionId))];
  const questions = await db.questions.bulkGet(questionIds);
  const valid = questions.filter(Boolean) as Question[];
  const grouped: Record<string, Question[]> = {};
  for (const q of valid) {
    const typeName = typeLabel(q.type);
    if (!grouped[typeName]) grouped[typeName] = [];
    grouped[typeName].push(q);
  }
  return grouped;
}

export async function getWrongQuestionsByKnowledge(): Promise<Record<string, Question[]>> {
  const records = await db.wrongRecords.toArray();
  const questionIds = [...new Set(records.map((r) => r.questionId))];
  const questions = await db.questions.bulkGet(questionIds);
  const valid = questions.filter(Boolean) as Question[];
  const grouped: Record<string, Question[]> = {};
  for (const q of valid) {
    for (const kp of q.knowledgePoints) {
      const chapter = chapterOnly(kp);
      if (!grouped[chapter]) grouped[chapter] = [];
      if (!grouped[chapter].find((x) => x.id === q.id)) grouped[chapter].push(q);
    }
  }
  return grouped;
}

export async function markWrongAsReviewed(id: string): Promise<void> {
  await db.wrongRecords.update(id, { reviewed: true });
}

export async function getWrongCount(): Promise<number> {
  const records = await db.wrongRecords.filter(r => !r.reviewed).toArray();
  return records.length;
}

// ============ 笔记操作 ============

export async function saveNote(questionId: string, strokes: string): Promise<void> {
  const existing = await db.notes.where('questionId').equals(questionId).first();
  if (existing) {
    await db.notes.update(existing.id, { strokes, createdAt: Date.now() });
  } else {
    await db.notes.add({ id: uuidv4(), questionId, strokes, createdAt: Date.now() });
  }
}

export async function getNote(questionId: string): Promise<NoteAnnotation | undefined> {
  return db.notes.where('questionId').equals(questionId).first();
}

// ============ 练习记录 ============

export async function saveSession(session: Omit<PracticeSession, 'id'>): Promise<string> {
  const id = uuidv4();
  await db.sessions.add({ ...session, id });
  return id;
}

export async function getRecentSessions(days: number = 30): Promise<PracticeSession[]> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return db.sessions.where('startTime').above(cutoff).reverse().toArray();
}

// ============ 设置操作 ============

export async function getSettings(): Promise<AppSettings> {
  const row = await db.settings.get('app');
  if (row) return { ...defaultAppSettings, ...row.value };
  return defaultAppSettings;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ key: 'app', value: settings });
}

// ============ 统计 ============

export async function getStats() {
  const questions = await getAllQuestions();
  const sessions = await getRecentSessions(30);
  const totalWrong = await getWrongCount();
  const totalQuestions = questions.length;
  const practicedQuestions = questions.filter((q) => q.lastPracticed > 0).length;
  const totalCorrect = questions.reduce((s, q) => s + q.correctCount, 0);
  const totalAttempts = totalCorrect + questions.reduce((s, q) => s + q.wrongCount, 0);
  const overallAccuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const kpStats: Record<string, { correct: number; wrong: number; total: number }> = {};
  for (const q of questions) {
    for (const kp of q.knowledgePoints) {
      const chapter = chapterOnly(kp);
      if (!kpStats[chapter]) kpStats[chapter] = { correct: 0, wrong: 0, total: 0 };
      kpStats[chapter].correct += q.correctCount;
      kpStats[chapter].wrong += q.wrongCount;
      kpStats[chapter].total += q.correctCount + q.wrongCount;
    }
  }

  const weakPoints = Object.entries(kpStats)
    .filter(([, v]) => v.total >= 2)
    .map(([kp, v]) => ({
      knowledgePoint: kp,
      accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      total: v.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 10);

  const today = new Date();
  const last7Days: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const start = d.getTime();
    d.setHours(23, 59, 59, 999);
    const end = d.getTime();
    last7Days.push(sessions.filter((s) => s.startTime >= start && s.startTime <= end).length);
  }

  return {
    totalQuestions, practicedQuestions, overallAccuracy, totalWrong,
    weakPoints, last7Days,
    last7DaysLabels: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return `${d.getMonth() + 1}/${d.getDate()}`;
    }),
    recentSessions: sessions.slice(0, 20),
    knowledgeStats: Object.entries(kpStats)
      .map(([kp, v]) => ({
        knowledgePoint: kp,
        accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
        total: v.total,
      }))
      .sort((a, b) => b.total - a.total),
  };
}

// ============ 辅助 ============

// 知识点只保留章节（去掉子知识点）
export function chapterOnly(kp: string): string {
  const idx = kp.indexOf(' - ');
  return idx > 0 ? kp.slice(0, idx) : kp;
}

export function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    single: '单选题', multiple: '多选题', judge: '判断题', fill: '填空题', essay: '简答题',
  };
  return labels[type] || type;
}
