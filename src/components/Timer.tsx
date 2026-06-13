import { useState, useEffect, useRef } from 'react';

interface TimerProps {
  totalSeconds: number;
  onTimeUp: () => void;
  isRunning: boolean;
}

export default function Timer({ totalSeconds, onTimeUp, isRunning }: TimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const calledRef = useRef(false);

  useEffect(() => {
    setRemaining(totalSeconds);
    calledRef.current = false;
  }, [totalSeconds]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!calledRef.current) {
            calledRef.current = true;
            setTimeout(onTimeUp, 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, onTimeUp]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const progress = totalSeconds > 0 ? (remaining / totalSeconds) * 100 : 0;

  const isUrgent = remaining < 60;
  const isWarning = remaining < totalSeconds * 0.3;

  return (
    <div className="flex items-center gap-3">
      {/* 🍏 进度条 */}
      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden" style={{ border: '1px solid #e8f5e0' }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${progress}%`,
            background: isUrgent
              ? 'linear-gradient(90deg, #ff6b6b, #ff8787)'
              : isWarning
                ? 'linear-gradient(90deg, #ffd43b, #fab005)'
                : 'linear-gradient(90deg, #9ae869, #5cb818)',
          }}
        />
      </div>

      {/* 时间显示 */}
      <div className="flex items-center gap-1">
        <span className="text-sm">🍏</span>
        <span
          className="text-sm font-mono font-bold min-w-[4.5rem] text-right"
          style={{ color: isUrgent ? '#e03131' : isWarning ? '#e67700' : '#387612' }}
        >
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}

/**
 * 根据题目数量计算建议时间（秒）
 */
export function calculateTime(questionCount: number, minutesPerQuestion: number = 2): number {
  return questionCount * minutesPerQuestion * 60;
}
