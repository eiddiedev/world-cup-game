import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => {
  const variantId = process.env.VITE_VARIANT_ID
    || (mode === 'compliant' ? 'compliant-full' : mode === 'interactive' ? 'compliant-interactive' : 'showcase-full')
  const isInteractive = variantId === 'compliant-interactive'
  const isCompliant = variantId === 'compliant-full' || isInteractive
  const isLabsBuild = mode === 'labs'
  const configuredPublicDir = process.env.TARGETING_PUBLIC_DIR
  const publicDir = isInteractive && process.env.TARGETING_SKIP_PUBLIC_STAGE === '1'
    ? false
    : configuredPublicDir
      ? resolve(process.cwd(), configuredPublicDir)
      : 'public'
  const outDir = process.env.TARGETING_OUTPUT_DIR
    ? resolve(process.cwd(), process.env.TARGETING_OUTPUT_DIR)
    : resolve(process.cwd(), '.variant-build', variantId)

  return {
    base: './',
    publicDir,
    plugins: [react()],
    resolve: {
      alias: {
        '@competition-brand': fileURLToPath(new URL(
          isCompliant
            ? './src/config/competitionBrand.compliant.js'
            : './src/config/competitionBrand.showcase.js',
          import.meta.url,
        )),
      },
    },
    define: {
      '__DOUYIN_BUILD__': JSON.stringify(isInteractive),
      ...(isInteractive ? { 'process.env.NODE_ENV': JSON.stringify('production') } : {}),
    },
    build: {
      outDir,
      emptyOutDir: true,
      ...(isLabsBuild ? {
        rollupOptions: {
          input: {
            main: fileURLToPath(new URL('./index.html', import.meta.url)),
            happySeedRuntime: fileURLToPath(new URL('./happyseed-runtime.html', import.meta.url)),
            happySeedRuntimeLab: fileURLToPath(new URL('./happyseed-runtime-lab.html', import.meta.url)),
            happySeedDecisionReview: fileURLToPath(new URL('./happyseed-decision-review.html', import.meta.url)),
            pixelPlayerStudio: fileURLToPath(new URL('./pixel-player-studio.html', import.meta.url)),
          },
        },
      } : isInteractive ? {
        lib: {
          entry: fileURLToPath(new URL('./src/main.jsx', import.meta.url)),
          name: 'Targeting2026Interactive',
          formats: ['iife'],
          fileName: () => 'game.js',
          cssFileName: 'game',
        },
      } : {
        rollupOptions: {
          input: fileURLToPath(new URL('./index.html', import.meta.url)),
        },
      }),
    },
  }
})
