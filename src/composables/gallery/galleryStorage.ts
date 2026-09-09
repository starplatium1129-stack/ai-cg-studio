import { kvInit, kvGet, kvSet } from '@/composables/useKVStore'
import { parseArtworkRecords } from '@/types/artwork'
import { ARTWORK_HISTORY_KV_KEY, ARTWORK_PROJECTS_KV_KEY } from '@/utils/storageKeys'
import type { useGalleryWorkspace } from './useGalleryWorkspace'
export interface GalleryProject {
        id: string;
        title: string;
        history_ids: Array<string | number>;
    }
const HISTORY_KEY = ARTWORK_HISTORY_KV_KEY;
const PROJECT_KEY = ARTWORK_PROJECTS_KV_KEY;
const LEGACY_PROJECT_KEY = 'aics_projects';
export async function loadGalleryStorageAction({ galleryLoading, galleryError, history, projects }: Pick<ReturnType<typeof useGalleryWorkspace>, "galleryLoading" | "galleryError" | "history" | "projects">): Promise<void> {
        galleryLoading.value = true;
        galleryError.value = '';
        try {
            await kvInit();
            let historyRaw: unknown = await kvGet(HISTORY_KEY);
            let projectRaw: unknown = await kvGet(PROJECT_KEY);
            if (!historyRaw) {
                try {
                    historyRaw = JSON.parse(localStorage.getItem(HISTORY_KEY) || 'null');
                }
                catch { }
                if (Array.isArray(historyRaw) && historyRaw.length) {
                    await kvSet(HISTORY_KEY, historyRaw);
                    localStorage.removeItem(HISTORY_KEY);
                }
            }
            if (!projectRaw) {
                try {
                    projectRaw = JSON.parse(localStorage.getItem(PROJECT_KEY) || 'null');
                }
                catch { }
                if (Array.isArray(projectRaw) && projectRaw.length) {
                    await kvSet(PROJECT_KEY, projectRaw);
                    localStorage.removeItem(PROJECT_KEY);
                }
            }
            // 一次性迁移：把旧键 'aics_projects' 下的项目搬到统一键，避免用户之前建的项目凭空消失
            if (!projectRaw) {
                let legacy: unknown = await kvGet(LEGACY_PROJECT_KEY).catch(() => null);
                if (!legacy) {
                    try {
                        legacy = JSON.parse(localStorage.getItem(LEGACY_PROJECT_KEY) || 'null');
                    }
                    catch { }
                }
                if (Array.isArray(legacy) && legacy.length) {
                    projectRaw = legacy;
                    await kvSet(PROJECT_KEY, legacy);
                    localStorage.removeItem(LEGACY_PROJECT_KEY);
                }
            }
            history.value = parseArtworkRecords(historyRaw);
            projects.value = Array.isArray(projectRaw)
                ? projectRaw.flatMap((item): GalleryProject[] => {
                    if (!item || typeof item !== 'object')
                        return [];
                    const raw = item as Record<string, unknown>;
                    if (typeof raw.id !== 'string' && typeof raw.id !== 'number')
                        return [];
                    return [{
                            id: String(raw.id),
                            title: String(raw.title || raw.name || raw.id),
                            history_ids: Array.isArray(raw.history_ids)
                                ? raw.history_ids.filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
                                : [],
                        }];
                })
                : [];
        }
        catch (e) {
            galleryError.value = e instanceof Error ? e.message : String(e);
        }
        finally {
            galleryLoading.value = false;
        }
    }
