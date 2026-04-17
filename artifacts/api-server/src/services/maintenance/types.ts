export interface SweepResult {
  sweep: string;
  scanned: number;
  deleted: number;
  archived: number;
  durationMs: number;
  errors: string[];
}

export interface SweepContext {
  /** Prevent running if a feed update is in progress. */
  feedUpdateRunning: boolean;
}

export interface Sweep {
  name: string;
  /** Cron expression — used only for documentation; scheduling is in feedScheduler. */
  schedule: string;
  run(ctx: SweepContext): Promise<SweepResult>;
}
