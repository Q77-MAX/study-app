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
  const isUrgent = remaining < 60;
  const isWarning = remaining < totalSeconds * 0.3;

  const bgColor = isUrgent ? '#fee2e2' : isWarning ? '#fff7e0' : '#f2fde4';
  const textColor = isUrgent ? '#e03131' : isWarning ? '#e67700' : '#387612';
  const borderColor = isUrgent ? '#ffc9c9' : isWarning ? '#ffd43b' : '#9ae869';

  return (
    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold"
      style={{ background: bgColor, border: `1.5px solid ${borderColor}`, color: textColor }}>
      <span>⏱</span>
      <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
    </div>
  );
}

/**
 * 根据题目数量计算建议时间（秒）
 */
export function calculateTime(questionCount: number, minutesPerQuestion: number = 2): number {
  return questionCount * minutesPerQuestion * 60;
}
