import { useRef, useEffect, useState, useCallback } from 'react';
import type { Stroke } from '../types';
import { saveNote, getNote } from '../store/db';

interface DrawingPadProps { questionId: string; }

const COLORS = ['#333333', '#e03131', '#4a9b10', '#1976d2', '#e67700', '#7b1fa2'];
const WIDTHS = [2, 4, 6];

export default function DrawingPad({ questionId }: DrawingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [color, setColor] = useState('#333333');
  const [width, setWidth] = useState(3);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!questionId) return;
    getNote(questionId).then((note) => {
      if (note?.strokes) {
        try { setStrokes(JSON.parse(note.strokes)); } catch {}
      } else { setStrokes([]); }
    });
  }, [questionId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fafdf6';
    ctx.fillRect(0, 0, w, h);
    // 辅助线
    ctx.strokeStyle = '#e8f5e0';
    ctx.lineWidth = 0.5;
    for (let y = 30; y < h; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [strokes, currentStroke]);

  const getPos = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    setCurrentStroke({
      points: [getPos(e)],
      color: tool === 'eraser' ? '#fafdf6' : color,
      width: tool === 'eraser' ? width * 4 : width,
    });
    setIsDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !currentStroke) return;
    setCurrentStroke({ ...currentStroke, points: [...currentStroke.points, getPos(e)] });
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentStroke) return;
    setIsDrawing(false);
    const newStrokes = [...strokes, currentStroke];
    setStrokes(newStrokes);
    setCurrentStroke(null);
    saveNote(questionId, JSON.stringify(newStrokes));
  };

  return (
    <div className="card-apple overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm hover:bg-gray-50/50 transition-colors"
        style={{ color: '#387612' }}
      >
        <span className="flex items-center gap-2 font-medium">
          ✏️ 手写笔记
          {strokes.length > 0 && (
            <span className="badge-apple text-xs">{strokes.length}</span>
          )}
        </span>
        <span className="text-gray-400 text-xs">{expanded ? '收起 ▲' : '展开 ▼'}</span>
      </button>

      {expanded && (
        <div>
          <div className="flex items-center gap-2 px-3 py-2 flex-wrap" style={{ borderTop: '2px solid #f2fde4', borderBottom: '2px solid #f2fde4', background: '#fafdf6' }}>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { setColor(c); setTool('pen'); }}
                className="w-6 h-6 rounded-full border-2 transition-transform"
                style={{
                  backgroundColor: c,
                  borderColor: color === c && tool === 'pen' ? '#387612' : '#ddd',
                  transform: color === c && tool === 'pen' ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            ))}
            <div className="w-px h-5 bg-gray-300 mx-1" />
            {WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setWidth(w)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-xs"
                style={{ background: width === w ? '#f2fde4' : 'transparent', color: width === w ? '#387612' : '#999' }}
              >
                <div className="rounded-full bg-current" style={{ width: w + 2, height: w + 2 }} />
              </button>
            ))}
            <div className="w-px h-5 bg-gray-300 mx-1" />
            <button
              onClick={() => setTool(tool === 'eraser' ? 'pen' : 'eraser')}
              className="px-2 py-1 text-xs rounded-lg transition-colors"
              style={{ background: tool === 'eraser' ? '#fff0f0' : 'transparent', color: tool === 'eraser' ? '#e03131' : '#999' }}
            >
              🧹
            </button>
            <button
              onClick={() => {
                const newStrokes = strokes.slice(0, -1);
                setStrokes(newStrokes);
                saveNote(questionId, JSON.stringify(newStrokes));
              }}
              disabled={strokes.length === 0}
              className="px-2 py-1 text-xs rounded-lg disabled:opacity-30 text-gray-500"
            >
              ↩
            </button>
            <button
              onClick={() => {
                if (confirm('确定清除所有笔记？')) {
                  setStrokes([]);
                  saveNote(questionId, JSON.stringify([]));
                }
              }}
              disabled={strokes.length === 0}
              className="px-2 py-1 text-xs rounded-lg disabled:opacity-30"
              style={{ color: '#e03131' }}
            >
              🗑
            </button>
          </div>
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-full h-48 touch-none"
            style={{ touchAction: 'none' }}
          />
        </div>
      )}
    </div>
  );
}
