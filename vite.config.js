import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDouyinDemo = mode === 'douyin'
  const phaserLoader = fileURLToPath(new URL(
    isDouyinDemo
      ? './src/utils/phaserLoader.demo.js'
      : './src/utils/phaserLoader.js',
    import.meta.url,
  ))

  return {
    base: isDouyinDemo ? './' : '/',
    publicDir: isDouyinDemo ? false : 'public',
    plugins: [react()],
    define: isDouyinDemo ? {
      'process.env.NODE_ENV': JSON.stringify('production'),
    } : undefined,
    resolve: {
      alias: {
        '@phaser-loader': phaserLoader,
      },
    },
    build: {
      outDir: isDouyinDemo ? 'dist-douyin' : 'dist',
      emptyOutDir: true,
      ...(!isDouyinDemo ? {
        rollupOptions: {
          input: {
            main: fileURLToPath(new URL('./index.html', import.meta.url)),
            happySeedRuntime: fileURLToPath(new URL('./happyseed-runtime.html', import.meta.url)),
            happySeedRuntimeLab: fileURLToPath(new URL('./happyseed-runtime-lab.html', import.meta.url)),
            happySeedDecisionReview: fileURLToPath(new URL('./happyseed-decision-review.html', import.meta.url)),
            happySeedRainTest: fileURLToPath(new URL('./happyseed-rain-test.html', import.meta.url)),
          },
        },
      } : {}),
      ...(isDouyinDemo ? {
        lib: {
          entry: fileURLToPath(new URL('./src/main.jsx', import.meta.url)),
          name: 'Targeting2026Demo',
          formats: ['iife'],
          fileName: () => 'game.js',
          cssFileName: 'game',
        },
      } : {}),
    },
  }
})
