import type { ActiveJob } from './jobCompletion';

export interface LockedJobStartUser {
  id: number;
  level: number;
  faction: string | null;
  premiumUntil: number;
  activeJob: string | ActiveJob | null;
}

export interface JobCatalogEntry {
  id: number;
  name: string;
  duration: number;
  rewardMin: number;
  rewardMax: number;
  background: string | null;
}

export interface JobStartTransaction {
  lockUser(userId: number): Promise<LockedJobStartUser | null>;
  findJob(jobId: number): Promise<JobCatalogEntry | null>;
  findJobsByDuration(duration: number): Promise<JobCatalogEntry[]>;
  saveActiveJob(userId: number, activeJob: ActiveJob): Promise<void>;
}

export interface JobStartRepository {
  transaction<T>(callback: (tx: JobStartTransaction) => Promise<T>): Promise<T>;
}

export interface StartJobInput {
  userId: number;
  jobId?: number;
  duration?: number;
  now: number;
  random?: () => number;
}

export type StartJobResult = {
  started: true;
  job: ActiveJob;
  rewardMin: number;
  rewardMax: number;
  background: string | null;
} | {
  started: false;
  reason: 'user-not-found' | 'already-active' | 'job-not-found';
};

function choose<T>(values: T[], random: () => number): T | null {
  if (values.length === 0) return null;
  const index = Math.min(values.length - 1, Math.floor(random() * values.length));
  return values[index] ?? null;
}

export async function startJob(repository: JobStartRepository, input: StartJobInput): Promise<StartJobResult> {
  const random = input.random ?? Math.random;
  return repository.transaction(async tx => {
    const user = await tx.lockUser(input.userId);
    if (!user) return { started: false, reason: 'user-not-found' };
    if (user.activeJob) return { started: false, reason: 'already-active' };

    const catalogJob = input.jobId !== undefined
      ? await tx.findJob(input.jobId)
      : choose(await tx.findJobsByDuration(Number(input.duration)), random);
    if (!catalogJob) return { started: false, reason: 'job-not-found' };

    const level = Math.max(1, Number(user.level || 1));
    const scaledMax = Number(catalogJob.rewardMax) * level;
    let reward = Math.floor(random() * (scaledMax - Number(catalogJob.rewardMin) + 1)) + Number(catalogJob.rewardMin);
    if (user.faction === 'crafter') reward *= 2;

    let premiumBonus = 0;
    if (Number(user.premiumUntil || 0) > input.now) {
      premiumBonus = Math.max(1, Math.floor(random() * Math.floor(reward * 0.3)) + 1);
      reward += premiumBonus;
    }

    const job: ActiveJob = {
      jobId: Number(catalogJob.id),
      name: String(catalogJob.name),
      startTime: input.now,
      endTime: input.now + Number(catalogJob.duration),
      reward,
      duration: Number(catalogJob.duration),
      expReward: Math.max(1, Math.floor(Number(catalogJob.duration) / 3600)),
      premiumBonus,
      rewardMin: Number(catalogJob.rewardMin),
      rewardMax: scaledMax,
      background: catalogJob.background || null,
    };
    await tx.saveActiveJob(user.id, job);
    return {
      started: true,
      job,
      rewardMin: Number(catalogJob.rewardMin),
      rewardMax: scaledMax,
      background: catalogJob.background || null,
    };
  });
}
