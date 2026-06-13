import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'build' ? '/study-app/' : '/',
  server: {
    host: '0.0.0.0', // 允许局域网访问，方便手机测试
    port: 5173,
  },
}))
