import type { ControlDiagnostics } from '../types/api.ts'
import { diagnosticSnapshot } from './localDiagnostics.ts'

/** Allow-list fields instead of trying to find every possible secret in arbitrary logs. */
export function buildDiagnosticExport(data: ControlDiagnostics, appVersion: string, dataVersion: number) {
  const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0
  return {
    type: 'huiyu-diagnostics', schemaVersion: 2, exportedAt: new Date().toISOString(),
    appVersion, dataVersion,
    environment: {
      uptime: number(data.uptime), port: number(data.port),
      nodeVersion: /^v\d+\.\d+\.\d+$/.test(data.nodeVersion) ? data.nodeVersion : 'unknown',
      platform: ['win32', 'darwin', 'linux'].includes(data.platform) ? data.platform : 'unknown',
      tunnelDisabled: data.disableTunnel === true,
      scripts: {
        voiceStart: data.scripts?.voiceStartExists === true,
        voiceStop: data.scripts?.voiceStopExists === true,
        webui: data.scripts?.webuiExists === true,
      },
      operation: data.operation ? {
        status: ['running', 'completed', 'failed'].includes(data.operation.status) ? data.operation.status : 'unknown',
        startedAt: number(data.operation.startedAt), finishedAt: number(data.operation.finishedAt),
      } : null,
    },
    diagnostics: diagnosticSnapshot(),
  }
}
