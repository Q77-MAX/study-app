import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 🔍 全局错误捕获 — 显示白屏时帮助定位问题
window.addEventListener('error', (e) => {
  const root = document.getElementById('root')
  if (root && !root.innerHTML.trim()) {
    root.innerHTML = `<div style="padding:30px;font-family:sans-serif;color:#e03131;background:#fff5f5;min-height:100vh">
      <h2 style="font-size:20px;margin-bottom:12px">🍎 页面加载失败</h2>
      <p style="font-size:14px;margin-bottom:8px"><b>错误：</b>${e.message}</p>
      <p style="font-size:14px;margin-bottom:8px"><b>文件：</b>${e.filename}</p>
      <p style="font-size:14px;margin-bottom:8px"><b>行号：</b>${e.lineno}:${e.colno}</p>
      <details style="margin-top:12px"><summary style="font-size:13px;cursor:pointer;color:#999">完整堆栈</summary>
        <pre style="font-size:12px;color:#666;white-space:pre-wrap;margin-top:8px">${e.error?.stack || '(无)'}</pre>
      </details>
    </div>`
  }
})

// 注册 Service Worker（PWA 离线缓存 & 可安装）
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js')
    .then(() => console.log('SW registered'))
    .catch(() => console.log('SW registration failed'))
}

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (e: any) {
  document.getElementById('root')!.innerHTML = `<div style="padding:30px;font-family:sans-serif;color:#e03131;background:#fff5f5;min-height:100vh">
    <h2 style="font-size:20px;margin-bottom:12px">🍎 React 渲染失败</h2>
    <pre style="font-size:13px;color:#666;white-space:pre-wrap">${e.message}\n\n${e.stack}</pre>
  </div>`
}
