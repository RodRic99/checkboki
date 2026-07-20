import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 패키지 앱은 file://로 index.html을 열기 때문에 /assets가 아닌 ./assets 상대경로가 필요하다.
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
