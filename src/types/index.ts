// ============ 题目相关 ============
export type QuestionType = 'single' | 'multiple' | 'judge' | 'fill' | 'essay';

export interface Question {
  id: string;
  type: QuestionType;
  content: string;
  options: string[];
  answer: string;
  explanation: string;
  knowledgePoints: string[];
  difficulty: number;
  correctCount: number;
  wrongCount: number;
  lastPracticed: number;
  mastery: number;
  createdAt: number;
  batchId: string;       // 所属题库ID
  batchName: string;     // 所属题库名称
}

// ============ 题库分组 ============
export interface QuestionBank {
  id: string;
  name: string;
  questionCount: number;
  createdAt: number;
}

// ============ 错题记录 ============
export interface WrongRecord {
  id: string;
  questionId: string;
  userAnswer: string;
  timestamp: number;
  reviewed: boolean;
}

// ============ 手写笔记 ============
export interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface NoteAnnotation {
  id: string;
  questionId: string;
  strokes: string;
  createdAt: number;
}

// ============ 练习记录 ============
export interface PracticeSession {
  id: string;
  mode: 'practice' | 'exam' | 'wrong_review';
  questionIds: string[];
  answers: Record<string, string>;
  score: number;
  totalQuestions: number;
  startTime: number;
  endTime: number;
}

// ============ AI 提供商 ============
export type AIProvider = 'anthropic' | 'openai' | 'deepseek' | 'custom';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  baseURL: string;
  model: string;
}

// ============ 应用设置 ============
export interface AppSettings {
  ai: AISettings;
  questionsPerSession: number;
  minutesPerQuestion: number;
  examQuestionCount: number;
  examTimeMinutes: number;
}

export const defaultAISettings: AISettings = {
  provider: 'anthropic',
  apiKey: '',
  baseURL: '',
  model: 'claude-sonnet-4-6',
};

export const defaultAppSettings: AppSettings = {
  ai: defaultAISettings,
  questionsPerSession: 10,
  minutesPerQuestion: 2,
  examQuestionCount: 20,
  examTimeMinutes: 60,
};

export const AI_PROVIDERS: Record<AIProvider, { name: string; defaultModel: string; defaultBaseURL: string }> = {
  anthropic: {
    name: 'Anthropic Claude',
    defaultModel: 'claude-sonnet-4-6',
    defaultBaseURL: 'https://api.anthropic.com/v1',
  },
  openai: {
    name: 'OpenAI',
    defaultModel: 'gpt-4o',
    defaultBaseURL: 'https://api.openai.com/v1',
  },
  deepseek: {
    name: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    defaultBaseURL: 'https://api.deepseek.com/v1',
  },
  custom: {
    name: '自定义接口',
    defaultModel: 'gpt-4o',
    defaultBaseURL: '',
  },
};
