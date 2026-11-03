import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import packageJSON from './package.json'
import { storyTypes } from './playwright/gallery/storyTypes'

if (!process.env.VITE_GIT_SHA) {
  try {
    const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
    process.env.VITE_GIT_SHA = execSync('git rev-parse HEAD', {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim()
  } catch {
    // Leave unset for environments without git (the footer hides itself).
  }
}

// https://vitejs.dev/config/
const frontendRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    storyTypes({
      prefix: packageJSON.name,
      src: path.resolve(frontendRoot, 'src'),
      outFile: path.resolve(frontendRoot, 'playwright/gallery/stories.d.ts'),
    }),
  ],
  define: {
    'process.env': {}
  },
  server: {
    proxy: {
      '/service/': 'https://try.playwright.tech',
      '/file-uploads/': 'https://try.playwright.tech'
    }
  }
})
