export interface BackupFileInfo {
  path: string;
  mtimeMs: number;
  size: number;
}

export interface RetentionPlan {
  keep: BackupFileInfo[];
  delete: BackupFileInfo[];
}

export function planRetention(
  files: ReadonlyArray<BackupFileInfo>,
  keepCount: number,
): RetentionPlan {
  if (keepCount < 0) {
    throw new Error(`keepCount must be >= 0, got ${keepCount}`);
  }

  const sorted = [...files].sort((a, b) => b.mtimeMs - a.mtimeMs);
  return {
    keep: sorted.slice(0, keepCount),
    delete: sorted.slice(keepCount),
  };
}

export function timestampForFilename(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}
