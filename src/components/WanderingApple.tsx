import { useState, useEffect, useRef, useCallback } from 'react';

const APPLES = ['🍏', '🍎', '🍏', '🍎'];

export default function WanderingApple() {
  const [pos, setPos] = useState({ x: 200, y: 300 });
  const [emoji, setEmoji] = useState(0);
  const [tapped, setTapped] = useState(false);
  const animRef = useRef<number>(0);
  const dirRef = useRef({ vx: 0.4, vy: 0.3 });
  const size = 64; // 特别大的苹果

  const animate = useCallback(() => {
    setPos(prev => {
      let { x, y } = prev;
      let { vx, vy } = dirRef.current;

      // 随机微调方向，模拟漂浮感
      vx += (Math.random() - 0.5) * 0.15;
      vy += (Math.random() - 0.5) * 0.15;
      // 限速
      const speed = Math.sqrt(vx * vx + vy * vy);
      const maxSpeed = 1.2;
      if (speed > maxSpeed) { vx = (vx / speed) * maxSpeed; vy = (vy / speed) * maxSpeed; }
      if (speed < 0.2) { vx *= 1.05; vy *= 1.05; }

      x += vx;
      y += vy;

      // 碰壁反弹
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (x < -20) { x = -20; vx = Math.abs(vx); }
      if (x > vw - size + 20) { x = vw - size + 20; vx = -Math.abs(vx); }
      if (y < -20) { y = -20; vy = Math.abs(vy); }
      if (y > vh - size - 80) { y = vh - size - 80; vy = -Math.abs(vy); }

      dirRef.current = { vx, vy };
      return { x, y };
    });
    animRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [animate]);

  const handleTap = () => {
    setTapped(true);
    setEmoji(prev => (prev + 1) % APPLES.length);
    // 点击后加一个弹跳效果
    dirRef.current.vy = -2;
    setTimeout(() => setTapped(false), 400);
  };

  return (
    <div
      onClick={handleTap}
      className="fixed z-10 select-none transition-transform duration-300"
      style={{
        left: pos.x,
        top: pos.y,
        fontSize: `${size}px`,
        lineHeight: 1,
        cursor: 'pointer',
        pointerEvents: 'auto',
        transform: tapped ? 'scale(1.3) rotate(20deg)' : 'scale(1)',
        filter: tapped ? 'drop-shadow(0 0 20px rgba(92,184,24,0.5))' : 'drop-shadow(0 4px 12px rgba(0,0,0,0.08))',
        transition: 'transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55), filter 0.4s ease',
      }}
    >
      {APPLES[emoji]}
    </div>
  );
}
