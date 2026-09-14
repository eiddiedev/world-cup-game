import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => {
  const variantId = process.env.VITE_VARIANT_ID || 'compliant-full'
  const isLabsBuild = mode === 'labs'
  const configuredPublicDir = process.env.TARGETING_PUBLIC_DIR
  const publicDir = configuredPublicDir
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
          './src/config/competitionBrand.compliant.js',
          import.meta.url,
        )),
      },
    },
    define: {
      // The current maintained target is still the compliant H5 baseline.
      // A future Douyin Mini Game adapter must opt into packaged-runtime behavior explicitly.
      '__DOUYIN_BUILD__': JSON.stringify(false),
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
      } : {
        rollupOptions: {
          input: fileURLToPath(new URL('./index.html', import.meta.url)),
        },
      }),
    },
  }
})
