import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

export interface Account {
  id: string;
  name: string;
  password_hash: string;
  status: 'approved' | 'pending' | 'rejected';
  is_admin: boolean;
  created_at: string;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return 'h_' + Math.abs(h).toString(36);
}

// ============ 账号管理 ============

export async function getAllAccounts(): Promise<Account[]> {
  const { data } = await supabase.from('profiles').select('*').order('created_at');
  return (data || []) as Account[];
}

export async function createAccount(name: string, password: string): Promise<Account> {
  // 检查是否已存在
  const { data: existing } = await supabase.from('profiles').select('id').eq('name', name);
  if (existing && existing.length > 0) throw new Error('用户名已存在');

  // 第一个注册的是管理员
  const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const isFirst = count === 0;

  const account: Account = {
    id: uuidv4(),
    name,
    password_hash: simpleHash(password),
    status: isFirst ? 'approved' : 'pending',
    is_admin: isFirst,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('profiles').insert(account);
  if (error) throw new Error(error.message);

  // 本地缓存登录状态
  localStorage.setItem('current_account', JSON.stringify(account));
  return account;
}

export async function loginAccount(name: string, password: string): Promise<Account> {
  const hash = simpleHash(password);
  const { data } = await supabase.from('profiles').select('*').eq('name', name).eq('password_hash', hash);
  if (!data || data.length === 0) {
    // 再检查是不是用户名存在但密码错
    const { data: byName } = await supabase.from('profiles').select('id,status').eq('name', name);
    if (byName && byName.length > 0) {
      if (byName[0].status === 'pending') throw new Error('账号审核中，请等待管理员审批');
      if (byName[0].status === 'rejected') throw new Error('账号已被拒绝');
      throw new Error('密码错误');
    }
    throw new Error('账号不存在');
  }
  if (data[0].status === 'pending') throw new Error('账号审核中，请等待管理员审批');
  if (data[0].status === 'rejected') throw new Error('账号已被拒绝');

  localStorage.setItem('current_account', JSON.stringify(data[0]));
  return data[0] as Account;
}

export async function deleteAccount(id: string): Promise<void> {
  await supabase.from('profiles').delete().eq('id', id);
}

// ============ 本地缓存 ============

export async function getCurrentAccount(): Promise<Account | null> {
  const cached = localStorage.getItem('current_account');
  if (cached) {
    // 验证账号仍然有效
    const parsed = JSON.parse(cached);
    const { data } = await supabase.from('profiles').select('*').eq('id', parsed.id);
    if (data && data.length > 0 && data[0].status === 'approved') {
      return data[0] as Account;
    }
    localStorage.removeItem('current_account');
  }
  return null;
}

export async function getCurrentAccountId(): Promise<string | null> {
  const acct = await getCurrentAccount();
  return acct?.id || null;
}

export async function clearCurrentAccount(): Promise<void> {
  localStorage.removeItem('current_account');
}

// ============ 审核 ============

export async function getPendingAccounts(): Promise<Account[]> {
  const { data } = await supabase.from('profiles').select('*').eq('status', 'pending').order('created_at');
  return (data || []) as Account[];
}

export async function approveAccount(id: string): Promise<void> {
  await supabase.from('profiles').update({ status: 'approved' }).eq('id', id);
}

export async function rejectAccount(id: string): Promise<void> {
  await supabase.from('profiles').update({ status: 'rejected' }).eq('id', id);
}

// ============ 管理员 ============

export async function isAdmin(): Promise<boolean> {
  const acct = await getCurrentAccount();
  return acct?.is_admin === true;
}

// ============ 邀请码 ============

export async function getInviteCode(): Promise<string | null> {
  const { data } = await supabase.from('settings').select('value').eq('key', 'invite_code');
  if (data && data.length > 0) return data[0].value;
  return null;
}

export async function setInviteCode(code: string): Promise<void> {
  await supabase.from('settings').upsert({ key: 'invite_code', value: code });
}

// ============ 导出 ============

export async function exportAccountData(): Promise<void> {
  const acct = await getCurrentAccount();
  if (!acct) return;
  const blob = new Blob([JSON.stringify({ accountName: acct.name, exportedAt: Date.now() })], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `青苹果刷题_${acct.name}_${new Date().toLocaleDateString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importAccountData(_jsonStr: string): Promise<void> {
  throw new Error('云端模式不支持导入，请直接登录账号');
}
