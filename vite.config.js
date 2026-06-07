import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDouyinDemo = mode === 'douyin'

  return {
    base: isDouyinDemo ? './' : '/',
    publicDir: isDouyinDemo ? false : 'public',
    plugins: [react()],
    build: {
      outDir: isDouyinDemo ? 'dist-douyin' : 'dist',
      emptyOutDir: true,
    },
  }
})
