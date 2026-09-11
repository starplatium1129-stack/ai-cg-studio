import { afterEach, describe, expect, it } from 'vitest'
import { createApiClient } from '../api/client'
import type { ControlDiagnostics } from '../types/api'
import { clearDiagnosticHistory, diagnosticSnapshot, recordDiagnosticTask, startDiagnosticRequest } from './localDiagnostics'
import { buildDiagnosticExport } from './diagnosticExport'

afterEach(clearDiagnosticHistory)
describe('local diagnostic metadata', () => {
  it('omits credentials, user content, dynamic paths and raw task identities', () => {
    recordDiagnosticTask('private-task-secret', 'image', 'running')
    startDiagnosticRequest('https://user:password@host/api/anima/jobs/private-job-secret?api_key=private-key', 'POST')('failed', 503)
    recordDiagnosticTask('private-task-secret', 'image', 'failed')
    const report = buildDiagnosticExport({
      uptime: 4, port: 3000, nodeVersion: 'v24.18.0', platform: 'win32',
      sdHost: 'https://private-user:private-password@host', runtimeConfig: { apiKey: 'private-key', prompt: 'private-prompt' },
      token: { suffix: 'private-suffix' }, scripts: { voiceStart: 'private-path', voiceStartExists: true },
      operation: { id: 'private-operation', status: 'failed', error: 'private-chat', startedAt: 1, finishedAt: 2 },
      imageData: 'private-pixels', logs: ['private-log'],
    } as unknown as ControlDiagnostics, '1.6.1', 123)
    const json = JSON.stringify(report)
    expect(json).not.toContain('private-')
    expect(json).not.toContain('password')
    expect(report).toMatchObject({ appVersion: '1.6.1', dataVersion: 123, environment: { operation: { status: 'failed' } } })
    const events = report.diagnostics.entries
    expect(events[1]).toMatchObject({ endpoint: '/api/anima/jobs/:resource', outcome: 'failed', status: 503, activeTaskIds: [events[0].id] })
    expect(events[2].id).toBe(events[0].id)
  })
  it('keeps bounded independent snapshots and records request failure and cancellation', async () => {
    for (let i = 0; i < 205; i++) startDiagnosticRequest('/api/status')('succeeded')
    const first = diagnosticSnapshot()
    expect(first.entries).toHaveLength(200)
    first.entries.length = 0
    expect(diagnosticSnapshot().entries).toHaveLength(200)
    const client = createApiClient(async () => Response.json({ ok: false, error: 'private-error-detail' }, { status: 503 }))
    await expect(client.request('/api/video/jobs?token=private-key')).rejects.toMatchObject({ status: 503 })
    const abort = new AbortController(); abort.abort()
    await expect(client.request('/api/video/jobs', { signal: abort.signal })).rejects.toMatchObject({ kind: 'aborted' })
    const events = diagnosticSnapshot().entries
    expect(events.at(-2)).toMatchObject({ outcome: 'failed', status: 503 })
    expect(events.at(-1)).toMatchObject({ outcome: 'cancelled' })
    expect(JSON.stringify(events)).not.toContain('private-')
  })
})
