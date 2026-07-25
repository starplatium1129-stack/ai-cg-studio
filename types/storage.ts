export type HistoryEntryId = string | number;

export interface HistoryEntry {
  id: HistoryEntryId;
  timestamp: number | string;
  image_id?: string | null;
  scene?: string;
  character?: string;
  story?: string;
  prompt?: string;
  version?: number | string;
  size?: string;
  seed?: number | string;
  favorite?: boolean;
  rating?: Record<string, number>;
  [key: string]: unknown;
}

export interface HistoryValidationResult {
  ok: boolean;
  reasons: string[];
}

export interface QuarantineRecord {
  entry: HistoryEntry | { value: unknown };
  reasons: string[];
  index: number;
  quarantinedAt: number;
}

export interface QuarantinePartition {
  good: HistoryEntry[];
  bad: QuarantineRecord[];
}

export interface StorageQuota {
  usage: number;
  quota: number;
  ratio: number | null;
}

export interface StorageHealthReport {
  ok: boolean;
  historyCount: number;
  imageCount: number;
  quarantineCount: number;
  orphanImageIds: string[];
  missingImageIds: string[];
  quarantineCandidates: QuarantineRecord[];
  quota: StorageQuota | null;
}
