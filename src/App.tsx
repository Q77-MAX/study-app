import { useState } from 'react';
import Layout, { type TabId } from './components/Layout';
import PracticePanel from './components/PracticePanel';
import ImportPanel from './components/ImportPanel';
import WrongBook from './components/WrongBook';
import StatsPanel from './components/StatsPanel';
import ExamMode from './components/ExamMode';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('practice');

  const renderContent = () => {
    switch (activeTab) {
      case 'practice':
        return <PracticePanel />;
      case 'import':
        return <ImportPanel />;
      case 'wrong':
        return <WrongBook />;
      case 'stats':
        return <StatsPanel />;
      case 'exam':
        return <ExamMode />;
      default:
        return <PracticePanel />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}
