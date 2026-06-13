import { useState, useRef, useEffect } from 'react';
import type { Question } from '../types';
import { getSettings } from '../store/db';
import { askAITutor } from '../services/ai';

interface AIAssistantProps {
  question: Question;
  isCorrect?: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIAssistant({ question, isCorrect, onClose }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const questionContext = `题目类型：${question.type}
题目内容：${question.content}
${question.options.length > 0 ? `选项：${question.options.join('\n')}` : ''}
正确答案：${question.answer}
解析：${question.explanation}
${isCorrect !== undefined ? `学生回答：${isCorrect ? '正确' : '错误'}` : ''}`;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    setError(null);

    try {
      const { ai: aiSettings } = await getSettings();
      if (!aiSettings.apiKey) throw new Error('请先在设置中配置 AI API Key');
      const conversation = [...messages, { role: 'user' as const, content: userMsg }];
      const reply = await askAITutor(aiSettings, questionContext, conversation);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setError(e.message || '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    '🍏 这道题的解题思路是什么？',
    '💡 我错在哪里了？',
    '📝 能给我一个类似的题目吗？',
    '🧠 这个知识点怎么记忆？',
  ];

  return (
    <div className="card-apple overflow-hidden animate-fadeIn">
      {/* 头部 */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '2px solid #f2fde4', background: '#fafdf6' }}>
        <span className="font-medium text-sm flex items-center gap-2" style={{ color: '#387612' }}>
          <span className="animate-float">🤖</span> AI 学习助手
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm transition-colors">
          关闭 ✕
        </button>
      </div>

      {/* 消息列表 */}
      <div className="h-64 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div>
            <p className="text-sm text-gray-400 mb-3">👇 快速提问：</p>
            <div className="space-y-2">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="block w-full text-left text-sm rounded-xl px-3 py-2.5 transition-all duration-200"
                  style={{ background: '#fafdf6', color: '#387612', border: '1px solid #dff9c8' }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
              style={{
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #7ad93f, #5cb818)'
                  : '#f5f5f5',
                color: msg.role === 'user' ? 'white' : '#333',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-2xl text-sm" style={{ background: '#f5f5f5', borderRadius: '16px 16px 16px 4px' }}>
              <span className="flex items-center gap-2" style={{ color: '#4a9b10' }}>
                <span className="animate-spin">🍏</span> 思考中...
              </span>
            </div>
          </div>
        )}

        {error && <div className="text-sm text-red-400 text-center p-2">{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="p-3 flex gap-2" style={{ borderTop: '2px solid #f2fde4' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder="输入你的问题..."
          className="input-apple flex-1"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="btn-apple px-4 py-2 text-sm disabled:opacity-40"
        >
          发送
        </button>
      </div>
    </div>
  );
}
