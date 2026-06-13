import Dexie, { type Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';

export interface Account {
  id: string;
  name: string;
  password: string;
  status: 'approved' | 'pending' | 'rejected';
  createdAt: number;
}

class AccountDB extends Dexie {
  accounts!: Table<Account, string>;
  currentAccount!: Table<{ key: string; value: string }, string>;

  constructor() {
    super('StudyApp_Accounts');
    this.version(1).stores({
      accounts: 'id',
      currentAccount: 'key',
    });
  }
}

const accountDB = new AccountDB();

// 简单hash（本地账号保护，不需要强加密）
function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return 'acct_' + Math.abs(h).toString(36);
}

export async function getAllAccounts(): Promise<Account[]> {
  return accountDB.accounts.orderBy('createdAt').toArray();
}

export async function createAccount(name: string, password: string): Promise<Account> {
  const all = await accountDB.accounts.toArray();
  if (all.find(a => a.name === name)) throw new Error('用户名已存在');
  // 如果还没有任何已通过的账号，自动通过（管理员）
  const hasApproved = all.some(a => a.status === 'approved');
  const shouldApprove = !hasApproved;
  const account: Account = {
    id: uuidv4(),
    name,
    password: simpleHash(password),
    status: shouldApprove ? 'approved' : 'pending',
    createdAt: Date.now(),
  };
  await accountDB.accounts.add(account);
  return account;
}

export async function loginAccount(name: string, password: string): Promise<Account> {
  const all = await accountDB.accounts.toArray();
  const account = all.find(a => a.name === name);
  if (!account) throw new Error('账号不存在');
  if (account.status === 'pending') throw new Error('账号审核中，请等待管理员审批');
  if (account.status === 'rejected') throw new Error('账号已被拒绝');
  if (account.password !== simpleHash(password)) throw new Error('密码错误');
  await setCurrentAccount(account.id);
  return account;
}

export async function deleteAccount(id: string): Promise<void> {
  // 删除该账号的数据
  const dbName = `StudyAppDB_${id}`;
  await new Dexie(dbName).delete();
  await accountDB.accounts.delete(id);
  const current = await getCurrentAccountId();
  if (current === id) await clearCurrentAccount();
}

export async function getCurrentAccountId(): Promise<string | null> {
  const row = await accountDB.currentAccount.get('active');
  return row?.value || null;
}

export async function setCurrentAccount(id: string): Promise<void> {
  await accountDB.currentAccount.put({ key: 'active', value: id });
}

export async function clearCurrentAccount(): Promise<void> {
  await accountDB.currentAccount.delete('active');
}

export async function getCurrentAccount(): Promise<Account | null> {
  const id = await getCurrentAccountId();
  if (!id) return null;
  return (await accountDB.accounts.get(id)) || null;
}

// ============ 审核管理 ============

export async function getPendingAccounts(): Promise<Account[]> {
  const all = await accountDB.accounts.toArray();
  return all.filter(a => a.status === 'pending');
}

export async function approveAccount(id: string): Promise<void> {
  await accountDB.accounts.update(id, { status: 'approved' });
}

export async function rejectAccount(id: string): Promise<void> {
  await accountDB.accounts.update(id, { status: 'rejected' });
}

// ============ 邀请码 ============

export async function getInviteCode(): Promise<string | null> {
  const row = await accountDB.currentAccount.get('invite_code');
  return row?.value || null;
}

export async function setInviteCode(code: string): Promise<void> {
  await accountDB.currentAccount.put({ key: 'invite_code', value: code });
}

// 第一个通过的即为管理员
export async function isAdmin(accountId: string): Promise<boolean> {
  const all = await accountDB.accounts.orderBy('createdAt').toArray();
  const firstApproved = all.find(a => a.status === 'approved');
  return firstApproved?.id === accountId;
}

// 导出当前账号数据
export async function exportAccountData(accountId: string, accountName: string): Promise<void> {
  const dbName = `StudyAppDB_${accountId}`;
  const sourceDB = new Dexie(dbName);
  await sourceDB.open();
  const tables = sourceDB.tables;
  const data: Record<string, any[]> = {};
  for (const t of tables) {
    data[t.name] = await t.toArray();
  }
  const blob = new Blob([JSON.stringify({ accountName, accountId, data, exportedAt: Date.now() })], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `青苹果刷题_${accountName}_${new Date().toLocaleDateString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// 导入数据到当前账号
export async function importAccountData(jsonStr: string): Promise<void> {
  const parsed = JSON.parse(jsonStr);
  if (!parsed.data || !parsed.accountId) throw new Error('无效的备份文件');
  const dbName = `StudyAppDB_${parsed.accountId}`;
  const targetDB = new Dexie(dbName);
  await targetDB.open();
  for (const [tableName, rows] of Object.entries(parsed.data)) {
    if ((rows as any[]).length > 0) {
      await targetDB.table(tableName).bulkPut(rows as any[]);
    }
  }
}
