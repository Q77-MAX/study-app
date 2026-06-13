import { useEffect, useRef } from 'react';

// 用 Web Audio API 生成舒缓的环境音（雨声/溪流风格的白噪音 + 轻柔旋律）
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let noiseNodes: AudioNode[] = [];

function createAmbient() {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.3;
  masterGain.connect(audioCtx.destination);

  // 白噪音 → 滤波 → 模拟轻柔雨声/溪流声
  const bufferSize = 2 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;

  // 低通滤波器：只保留沙沙声，去掉刺耳高频
  const lowpass = audioCtx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 800;
  lowpass.Q.value = 0.5;

  // 高通滤波器：去掉嗡嗡低频
  const highpass = audioCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 200;

  const noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0.15;

  noise.connect(lowpass);
  lowpass.connect(highpass);
  highpass.connect(noiseGain);
  noiseGain.connect(masterGain!);
  noise.start();

  noiseNodes = [noise, lowpass, highpass, noiseGain];

  // 轻柔的持续音符（C大调和弦，非常柔和）
  const notes = [261.63, 329.63, 392.00]; // C E G
  notes.forEach((freq, i) => {
    const osc = audioCtx!.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const noteGain = audioCtx!.createGain();
    noteGain.gain.value = 0.03; // 极低音量

    osc.connect(noteGain);
    noteGain.connect(masterGain!);
    osc.start();

    // 缓慢音量波动
    const lfo = audioCtx!.createOscillator();
    lfo.frequency.value = 0.02 + i * 0.01; // 极慢
    const lfoGain = audioCtx!.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(noteGain.gain);
    lfo.start();

    noiseNodes.push(osc, noteGain, lfo, lfoGain);
  });
}

function stopAmbient() {
  noiseNodes.forEach(n => {
    try { (n as any).stop?.(); } catch {}
    try { n.disconnect(); } catch {}
  });
  noiseNodes = [];
  if (masterGain) { masterGain.disconnect(); masterGain = null; }
  if (audioCtx) { audioCtx.close(); audioCtx = null; }
}

interface AmbientSoundProps {
  visible: boolean;
  volume: number;
  enabled: boolean;
  onToggle: () => void;
  onVolumeChange: (v: number) => void;
}

export default function AmbientSound({ visible, volume, enabled, onToggle, onVolumeChange }: AmbientSoundProps) {
  const initRef = useRef(false);

  useEffect(() => {
    if (enabled && !audioCtx) {
      createAmbient();
      initRef.current = true;
    } else if (!enabled && audioCtx) {
      stopAmbient();
      initRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (masterGain) {
      masterGain.gain.value = volume * 0.5; // 0-1 → 0-0.5
    }
  }, [volume]);

  if (!visible) return null;

  return (
    <div className="mb-5 p-4 rounded-2xl" style={{ border: '2px solid #dff9c8', background: '#fafff5' }}>
      <p className="font-medium text-gray-700 mb-3">🎵 环境音效</p>

      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onToggle}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
          style={{
            background: enabled ? '#f2fde4' : '#f5f5f5',
            border: enabled ? '2px solid #9ae869' : '2px solid #e5e5e5',
            color: enabled ? '#387612' : '#999',
          }}
        >
          {enabled ? '🔊 已开启' : '🔇 已关闭'}
        </button>
        <span className="text-xs text-gray-400">白噪音 + 轻柔和弦</span>
      </div>

      {enabled && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">音量</span>
          <span className="text-xs">🔉</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="flex-1 accent-apple-500"
          />
          <span className="text-xs">🔊</span>
        </div>
      )}
    </div>
  );
}

export { createAmbient, stopAmbient };
