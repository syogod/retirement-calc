import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const DEV_PLAN_FILE = resolve(import.meta.dirname, 'data/plan.json')

/** Mirrors the Docker image's nginx `/api/plan` endpoint under `npm run dev`, so
 * Save works locally too: GET reads data/plan.json (404 if absent), PUT overwrites it. */
function devPlanStorage(): Plugin {
  return {
    name: 'dev-plan-storage',
    configureServer(server) {
      server.middlewares.use('/api/plan', async (req, res) => {
        try {
          if (req.method === 'GET') {
            const body = await readFile(DEV_PLAN_FILE, 'utf8').catch(() => null)
            res.statusCode = body === null ? 404 : 200
            res.setHeader('Content-Type', 'application/json')
            res.end(body ?? '')
          } else if (req.method === 'PUT') {
            const chunks: Buffer[] = []
            for await (const chunk of req) chunks.push(chunk as Buffer)
            await mkdir(dirname(DEV_PLAN_FILE), { recursive: true })
            await writeFile(`${DEV_PLAN_FILE}.tmp`, Buffer.concat(chunks))
            await rename(`${DEV_PLAN_FILE}.tmp`, DEV_PLAN_FILE)
            res.statusCode = 204
            res.end()
          } else {
            res.statusCode = 405
            res.end()
          }
        } catch {
          res.statusCode = 500
          res.end()
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devPlanStorage()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
  },
})
