import { useState, useEffect, useRef } from 'react';
import Layout, { type TabId } from './components/Layout';
import PracticePanel from './components/PracticePanel';
import ImportPanel from './components/ImportPanel';
import WrongBook from './components/WrongBook';
import StatsPanel from './components/StatsPanel';
import ExamMode from './components/ExamMode';
import LoginScreen from './components/LoginScreen';
import { clearCurrentAccount } from './store/accounts';
import { setDBAccount, repairAllQuestions } from './store/db';
import type { Account } from './store/accounts';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('practice');
  const [account, setAccount] = useState<Account | null>(null);
  // 🔧 每次登录自动检查并修复题库数据
  useEffect(() => {
    if (account) {
      repairAllQuestions().then(n => {
        if (n > 0) console.log(`🔧 自动修复了 ${n} 道题目`);
      }).catch(() => {});
    }
  }, [account]);

  const handleLogin = (acct: Account) => {
    setAccount(acct);
  };

  const handleLogout = async () => {
    await clearCurrentAccount();
    setDBAccount(null);
    setAccount(null);
  };

  if (!account) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'practice': return <PracticePanel />;
      case 'import': return <ImportPanel />;
      case 'wrong': return <WrongBook />;
      case 'stats': return <StatsPanel />;
      case 'exam': return <ExamMode />;
      default: return <PracticePanel />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}
      accountName={account.name} onLogout={handleLogout}>
      {renderContent()}
    </Layout>
  );
}
