import { useState, useEffect } from 'react';
import { getAllAccounts, createAccount, loginAccount, deleteAccount, getCurrentAccount, exportAccountData, importAccountData, getInviteCode, type Account } from '../store/accounts';
import { setDBAccount } from '../store/db';

interface LoginScreenProps {
  onLogin: (account: Account) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importMode, setImportMode] = useState(false);
  const [hasAccounts, setHasAccounts] = useState(false);

  useEffect(() => { loadAccounts(); }, []);

  const loadAccounts = async () => {
    const list = await getAllAccounts();
    setAccounts(list);
    setHasAccounts(list.length > 0);
    // 自动登录上次账号
    const current = await getCurrentAccount();
    if (current) {
      setDBAccount(current.id);
      onLogin(current);
    }
  };

  const handleLogin = async () => {
    if (!name.trim() || !password.trim()) { setError('请填写用户名和密码'); return; }
    setLoading(true); setError(null);
    try {
      const account = await loginAccount(name.trim(), password);
      setDBAccount(account.id);
      onLogin(account);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim() || !password.trim()) { setError('请填写用户名和密码'); return; }
    if (password.length < 3) { setError('密码至少3位'); return; }
    // 如果已有账号（非首个），需要邀请码
    if (hasAccounts) {
      const code = await getInviteCode();
      if (!code) { setError('请联系管理员获取邀请码'); return; }
      if (inviteCode.trim() !== code) { setError('邀请码错误'); return; }
    }
    setLoading(true); setError(null);
    try {
      const account = await createAccount(name.trim(), password);
      setDBAccount(account.id);
      onLogin(account);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (account: Account) => {
    if (!confirm(`确定删除账号「${account.name}」及其所有数据？此操作不可恢复！`)) return;
    await deleteAccount(account.id);
    await loadAccounts();
  };

  const handleSwitch = async (account: Account) => {
    if (account.password) {
      const pw = prompt(`请输入「${account.name}」的密码`);
      if (!pw) return;
      try {
        await loginAccount(account.name, pw);
        setDBAccount(account.id);
        onLogin(account);
      } catch {
        alert('密码错误');
      }
    }
  };

  const handleExport = async (account: Account) => {
    setDBAccount(account.id);
    await exportAccountData(account.id, account.name);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        await importAccountData(text);
        alert('导入成功！请重新登录');
        setImportMode(false);
        await loadAccounts();
      } catch {
        alert('导入失败，请检查文件格式');
      }
    };
    input.click();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #f2fde4 0%, #fafdf6 50%, #fff 100%)' }}>
      {/* 大苹果 */}
      <div className="text-8xl animate-float mb-4">🍏</div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: '#387612' }}>青苹果刷题</h1>
      <p className="text-sm text-gray-400 mb-8">本地账号 · 数据安全</p>

      {/* 账号列表 */}
      {accounts.length > 0 && !importMode && (
        <div className="w-full max-w-sm mb-6 space-y-2">
          {accounts.map(a => (
            <div key={a.id} className="card-apple p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-700 truncate">{a.name}</p>
                <p className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleDateString()} 创建</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleExport(a)} className="text-xs px-2 py-1 rounded-lg hover:bg-gray-100" title="导出">📤</button>
                <button onClick={() => handleDelete(a)} className="text-xs px-2 py-1 rounded-lg hover:bg-red-50" style={{ color: '#e03131' }} title="删除">🗑</button>
                <button onClick={() => handleSwitch(a)} className="text-xs px-3 py-1.5 rounded-xl font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #5cb818, #387612)' }}>
                  进入
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {importMode ? (
        <div className="w-full max-w-sm card-apple p-5 text-center space-y-3">
          <p className="text-2xl">📥</p>
          <p className="font-medium text-gray-700">导入备份数据</p>
          <p className="text-xs text-gray-400">选择之前导出的 .json 文件</p>
          <button onClick={handleImport} className="w-full py-3 btn-apple">📁 选择文件</button>
          <button onClick={() => setImportMode(false)} className="text-sm text-gray-400">返回</button>
        </div>
      ) : (
        <div className="w-full max-w-sm card-apple p-5 space-y-4">
          <div className="flex rounded-xl overflow-hidden border-2 border-gray-100">
            <button onClick={() => setMode('login')}
              className="flex-1 py-2.5 text-sm font-medium transition-colors"
              style={{ background: mode === 'login' ? '#f2fde4' : 'white', color: mode === 'login' ? '#387612' : '#999' }}>
              登录
            </button>
            <button onClick={() => setMode('register')}
              className="flex-1 py-2.5 text-sm font-medium transition-colors"
              style={{ background: mode === 'register' ? '#f2fde4' : 'white', color: mode === 'register' ? '#387612' : '#999' }}>
              注册
            </button>
          </div>

          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="用户名" className="input-apple w-full" />

          <input value={password} onChange={e => setPassword(e.target.value)}
            type="password" placeholder="密码" className="input-apple w-full" />

          {mode === 'register' && hasAccounts && (
            <input value={inviteCode} onChange={e => setInviteCode(e.target.value)}
              type="text" placeholder="🔑 邀请码（向管理员索取）" className="input-apple w-full" />
          )}

          {error && <p className="text-sm text-red-500 text-center">🍎 {error}</p>}

          <button onClick={mode === 'login' ? handleLogin : handleRegister}
            disabled={loading}
            className="w-full py-3.5 btn-apple text-base font-bold disabled:opacity-50">
            {loading ? '🍏 处理中...' : (mode === 'login' ? '🍏 登录' : '🍏 注册')}
          </button>

          {mode === 'register' && (
            <p className="text-xs text-gray-400 text-center">密码至少3位，数据仅存储在本设备上</p>
          )}

          <button onClick={() => setImportMode(true)}
            className="w-full text-sm text-gray-400 hover:text-apple-600 transition-colors">
            📥 从备份文件导入
          </button>
        </div>
      )}

      <p className="text-xs text-gray-300 mt-8">数据完全本地 · 不上传任何服务器</p>
    </div>
  );
}
