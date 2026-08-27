import { ApiClientError, apiClient, type ApiClient, type ApiResponseObject } from './client.ts'
import type {
  CurationData,
  HomeHeroCharacter,
  HomeHeroManifestResult,
  HomeHeroSaveResult,
  MaintenanceBuildWebResult,
  MaintenanceFailure,
  MaintenanceRunResult,
  SceneDraft,
  SceneSaveResult,
  ShowcaseSaveResult,
  TagRecord,
} from '../types/api.ts'
import type { SceneBlueprint } from '../utils/popularContent.ts'

export const MAINTENANCE_API_TIMEOUTS = {
  query: 10_000,
  upload: 120_000,
  buildWeb: 120_000,
  run: 130_000,
  scenes: 390_000,
} as const

export interface MaintenanceCallOptions {
  signal?: AbortSignal
}

export interface SaveScenesPayload {
  scenes: SceneDraft[]
  tags: TagRecord[]
  curation: CurationData
  /** 可选：热门角色蓝图（scene-blueprints.json），传入时随场景一起保存并跑内容契约校验。 */
  blueprints?: SceneBlueprint[]
}

export interface SaveShowcasePayload {
  id: string
  image: string
  thumbnail: string
}

export interface BackupEntry {
  id: string
  label: string
  createdAt: string
  fileCount: number
}

export interface BackupListResult {
  ok: true
  entries: BackupEntry[]
}

export interface MaintenanceApi {
  buildWeb(options?: MaintenanceCallOptions): Promise<MaintenanceBuildWebResult>
  saveScenes(payload: SaveScenesPayload, options?: MaintenanceCallOptions): Promise<SceneSaveResult>
  run(task: string, options?: MaintenanceCallOptions): Promise<MaintenanceRunResult>
  saveShowcase(payload: SaveShowcasePayload, options?: MaintenanceCallOptions): Promise<ShowcaseSaveResult>
  getHomeHero(options?: MaintenanceCallOptions): Promise<HomeHeroManifestResult>
  resetHomeHero(character: HomeHeroCharacter, options?: MaintenanceCallOptions): Promise<HomeHeroSaveResult>
  saveHomeHero(character: HomeHeroCharacter, image: string, options?: MaintenanceCallOptions): Promise<HomeHeroSaveResult>
  listBackups(options?: MaintenanceCallOptions): Promise<BackupListResult>
}

function isObject(value: unknown): value is ApiResponseObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSuccess(value: ApiResponseObject): boolean {
  return value.ok === true
}

function isSceneSave(value: ApiResponseObject): boolean {
  return value.ok === true
    && typeof value.count === 'number'
    && typeof value.backup === 'string'
}

function isRunResult(value: ApiResponseObject): boolean {
  return value.ok === true
    && typeof value.task === 'string'
    && typeof value.label === 'string'
    && typeof value.output === 'string'
    && typeof value.exitCode === 'number'
}

function isHomeHeroManifest(value: ApiResponseObject): boolean {
  return value.ok === true
    && typeof value.version === 'number'
    && isObject(value.entries)
}

function isBackupList(value: ApiResponseObject): boolean {
  return value.ok === true && Array.isArray(value.entries)
}

export function maintenanceFailure(error: unknown): MaintenanceFailure | null {
  if (!(error instanceof ApiClientError) || !error.responseBody || error.responseBody.ok !== false) return null
  return error.responseBody as unknown as MaintenanceFailure
}

export function createMaintenanceApi(client: ApiClient = apiClient): MaintenanceApi {
  return {
    buildWeb(options: MaintenanceCallOptions = {}) {
      return client.request<MaintenanceBuildWebResult>('/api/maintenance/build-web', {
        method: 'POST',
        cache: 'no-store',
        signal: options.signal,
        timeoutMs: MAINTENANCE_API_TIMEOUTS.buildWeb,
        validate: isSuccess,
      })
    },

    saveScenes(payload: SaveScenesPayload, options: MaintenanceCallOptions = {}) {
      return client.request<SceneSaveResult>('/api/maintenance/scenes', {
        method: 'POST',
        cache: 'no-store',
        body: payload,
        signal: options.signal,
        timeoutMs: MAINTENANCE_API_TIMEOUTS.scenes,
        validate: isSceneSave,
      })
    },

    run(task: string, options: MaintenanceCallOptions = {}) {
      return client.request<MaintenanceRunResult>('/api/maintenance/run', {
        method: 'POST',
        cache: 'no-store',
        body: { task },
        signal: options.signal,
        timeoutMs: MAINTENANCE_API_TIMEOUTS.run,
        validate: isRunResult,
      })
    },

    saveShowcase(payload: SaveShowcasePayload, options: MaintenanceCallOptions = {}) {
      return client.request<ShowcaseSaveResult>('/api/maintenance/showcase', {
        method: 'POST',
        cache: 'no-store',
        body: payload,
        signal: options.signal,
        timeoutMs: MAINTENANCE_API_TIMEOUTS.upload,
        validate: isSuccess,
      })
    },

    getHomeHero(options: MaintenanceCallOptions = {}) {
      return client.request<HomeHeroManifestResult>('/api/maintenance/home-hero', {
        cache: 'no-store',
        signal: options.signal,
        timeoutMs: MAINTENANCE_API_TIMEOUTS.query,
        validate: isHomeHeroManifest,
      })
    },

    resetHomeHero(character: HomeHeroCharacter, options: MaintenanceCallOptions = {}) {
      return client.request<HomeHeroSaveResult>('/api/maintenance/home-hero', {
        method: 'POST',
        cache: 'no-store',
        body: { character, action: 'reset' },
        signal: options.signal,
        timeoutMs: MAINTENANCE_API_TIMEOUTS.upload,
        validate: isSuccess,
      })
    },

    saveHomeHero(character: HomeHeroCharacter, image: string, options: MaintenanceCallOptions = {}) {
      return client.request<HomeHeroSaveResult>('/api/maintenance/home-hero', {
        method: 'POST',
        cache: 'no-store',
        body: { character, image },
        signal: options.signal,
        timeoutMs: MAINTENANCE_API_TIMEOUTS.upload,
        validate: isSuccess,
      })
    },

    listBackups(options: MaintenanceCallOptions = {}) {
      return client.request<BackupListResult>('/api/maintenance/backups', {
        cache: 'no-store',
        signal: options.signal,
        timeoutMs: MAINTENANCE_API_TIMEOUTS.query,
        validate: isBackupList,
      })
    },
  }
}

export const maintenanceApi = createMaintenanceApi()
