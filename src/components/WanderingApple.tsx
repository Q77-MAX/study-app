import { useState, useEffect, useRef, useCallback } from 'react';

const EMOJIS = ['🍏', '🍎'];

interface AppleData {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  emoji: number;
  opacity: number;
}

function createApples(count: number): AppleData[] {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * (vw - 80),
    y: Math.random() * (vh - 200),
    vx: (Math.random() - 0.5) * 1.5,
    vy: (Math.random() - 0.5) * 1.5,
    size: 40 + Math.random() * 40,
    emoji: i % 2,
    opacity: 0.05 + Math.random() * 0.07,
  }));
}

// ============ 🍏 漂泊小苹果 ============
export default function WanderingApple() {
  const count = 5;
  const apples = useRef<AppleData[]>(createApples(count));
  const animRef = useRef<number>(0);
  const [, setTick] = useState(0);
  const [tapMap, setTapMap] = useState<Record<number, boolean>>({});

  const animate = useCallback(() => {
    const aw = window.innerWidth;
    const ah = window.innerHeight;
    apples.current.forEach(a => {
      a.vx += (Math.random() - 0.5) * 0.08;
      a.vy += (Math.random() - 0.5) * 0.08;
      const speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
      const maxSpeed = 1.0;
      if (speed > maxSpeed) { a.vx = (a.vx / speed) * maxSpeed; a.vy = (a.vy / speed) * maxSpeed; }
      if (speed < 0.15) { a.vx *= 1.1; a.vy *= 1.1; }

      a.x += a.vx;
      a.y += a.vy;

      if (a.x < -30) { a.x = -30; a.vx = Math.abs(a.vx); }
      if (a.x > aw - a.size + 30) { a.x = aw - a.size + 30; a.vx = -Math.abs(a.vx); }
      if (a.y < -30) { a.y = -30; a.vy = Math.abs(a.vy); }
      if (a.y > ah - a.size - 80) { a.y = ah - a.size - 80; a.vy = -Math.abs(a.vy); }
    });
    setTick(t => t + 1);
    animRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [animate]);

  const handleTap = (id: number, idx: number) => {
    setTapMap(prev => ({ ...prev, [id]: true }));
    apples.current[idx].vy = -3;
    apples.current[idx].emoji = (apples.current[idx].emoji + 1) % EMOJIS.length;
    setTimeout(() => setTapMap(prev => ({ ...prev, [id]: false })), 500);
  };

  return (
    <>
      {apples.current.map((a, idx) => (
        <div
          key={a.id}
          onClick={(e) => { e.stopPropagation(); handleTap(a.id, idx); }}
          className="fixed z-10 select-none"
          style={{
            left: a.x,
            top: a.y,
            fontSize: `${a.size}px`,
            lineHeight: 1,
            opacity: a.opacity,
            cursor: 'pointer',
            pointerEvents: 'auto',
            transform: tapMap[a.id] ? 'scale(1.4) rotate(25deg)' : 'scale(1)',
            filter: tapMap[a.id] ? 'drop-shadow(0 0 30px rgba(92,184,24,0.6)) brightness(1.3)' : 'none',
            transition: tapMap[a.id] ? 'transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55), filter 0.5s ease' : 'none',
          }}
        >
          {EMOJIS[a.emoji]}
        </div>
      ))}
    </>
  );
}
