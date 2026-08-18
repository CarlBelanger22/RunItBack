import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

export const DEFAULT_MILESTONE_SLUG = 'milestone-2026-08-18-failsafe';

export function milestoneDir(cwd: string, slug = DEFAULT_MILESTONE_SLUG): string {
  return resolve(cwd, 'backups', slug);
}

export function ensureMilestoneDir(cwd: string, slug = DEFAULT_MILESTONE_SLUG): string {
  const dir = milestoneDir(cwd, slug);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}
