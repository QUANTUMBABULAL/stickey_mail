import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const r = (...segments: string[]): string => resolve(__dirname, ...segments)

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': r('src/shared'),
        '@main': r('src/main')
      }
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        input: { index: r('src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': r('src/shared')
      }
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        input: { index: r('src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: r('src/renderer'),
    resolve: {
      alias: {
        '@': r('src/renderer/src'),
        '@shared': r('src/shared')
      }
    },
    plugins: [react(), tailwindcss()],
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        input: {
          widget: r('src/renderer/widget.html'),
          settings: r('src/renderer/settings.html')
        }
      }
    }
  }
})
