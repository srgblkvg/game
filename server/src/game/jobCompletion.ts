export type JobCompletionMode = 'expired' | 'force';

export interface ActiveJob {
  jobId: number;
  name: string;
  startTime: number;
  endTime: number;
  reward: number;
  duration: number;
  expReward?: number;
  premiumBonus?: number;
}

export interface LockedJobUser {
  id: number;
  activeJob: string | ActiveJob | null;
  money: number;
  exp: number;
  level: number;
  statPoints: number;
  expEnabled: boolean;
  totalJobMoney: number;
  totalJobSeconds: number;
  oauthProvider?: string | null;
  oauthId?: string | number | null;
}

export interface LockedJobGuild {
  guildId: number;
  taxRate: number;
}

export interface CompletedUserSettlement {
  userId: number;
  activeJob: null;
  money: number;
  exp: number;
  level: number;
  statPoints: number;
  totalJobMoney: number;
  totalJobSeconds: number;
}

export interface GuildTaxEntry {
  guildId: number;
  userId: number;
  amount: number;
  source: 'tax_job';
  createdAt: string;
}

export interface JobHistoryEntry {
  userId: number;
  jobId: number;
  jobName: string;
  duration: number;
  reward: number;
  startedAt: string;
  premiumBonus: number;
  xpGained: number;
}

export interface JobCompletionTransaction {
  lockUser(userId: number): Promise<LockedJobUser | null>;
  lockGuildForTax(userId: number): Promise<LockedJobGuild | null>;
  addGuildTax(entry: GuildTaxEntry): Promise<void>;
  saveCompletedUser(settlement: CompletedUserSettlement): Promise<void>;
  addHistory(entry: JobHistoryEntry): Promise<void>;
  clearActiveJob(userId: number): Promise<void>;
}

export interface JobCompletionRepository {
  transaction<T>(callback: (tx: JobCompletionTransaction) => Promise<T>): Promise<T>;
}

export interface CompleteJobInput {
  userId: number;
  now: number;
  mode: JobCompletionMode;
  expectedJobIdentity?: string;
}

export type CancelJobResult = { cancelled: true; job: ActiveJob } | { cancelled: false; reason: 'user-not-found' | 'no-active-job' | 'invalid-job' | 'job-changed' };

export type JobCompletionNoopReason = 'user-not-found' | 'no-active-job' | 'invalid-job' | 'job-changed' | 'pending';

export interface CompletedJobResult {
  completed: true;
  userId: number;
  job: ActiveJob;
  grossReward: number;
  tax: number;
  rewardAfterTax: number;
  money: number;
  exp: number;
  level: number;
  statPoints: number;
  levelsGained: number;
  xpGained: number;
  guildId: number | null;
  oauthProvider: string | null;
  oauthId: string | number | null;
}

export type CompleteJobResult = CompletedJobResult | {
  completed: false;
  reason: JobCompletionNoopReason;
};

export function jobIdentity(job: ActiveJob): string {
  return JSON.stringify([
    job.jobId,
    job.startTime,
    job.endTime,
    job.reward,
    job.duration,
    job.expReward ?? 0,
    job.premiumBonus ?? 0,
  ]);
}

function finiteNonNegative(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function parseActiveJob(value: LockedJobUser['activeJob']): ActiveJob | null {
  let parsed: any;
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const jobId = finiteNonNegative(parsed.jobId);
  const startTime = finiteNonNegative(parsed.startTime);
  const endTime = finiteNonNegative(parsed.endTime);
  const reward = finiteNonNegative(parsed.reward);
  const duration = finiteNonNegative(parsed.duration);
  if (jobId === null || startTime === null || endTime === null || reward === null || duration === null) return null;
  return {
    jobId,
    name: String(parsed.name || ''),
    startTime,
    endTime,
    reward,
    duration,
    expReward: finiteNonNegative(parsed.expReward) ?? 0,
    premiumBonus: finiteNonNegative(parsed.premiumBonus) ?? 0,
  };
}

function applyJobExp(user: LockedJobUser, requestedGain: number) {
  const xpGained = user.expEnabled ? requestedGain : 0;
  let exp = Number(user.exp || 0) + xpGained;
  let level = Math.max(1, Number(user.level || 1));
  let levelsGained = 0;
  const expForLevel = (currentLevel: number) => 10 * Math.pow(2, currentLevel - 1);
  while (exp >= expForLevel(level)) {
    exp -= expForLevel(level);
    level += 1;
    levelsGained += 1;
  }
  return {
    exp,
    level,
    levelsGained,
    statPoints: Number(user.statPoints || 0) + levelsGained * 5,
    xpGained,
  };
}

export async function completeJob(
  repository: JobCompletionRepository,
  input: CompleteJobInput,
): Promise<CompleteJobResult> {
  return repository.transaction(async tx => {
    // Global lock order starts with users. All state is re-read after this lock.
    const user = await tx.lockUser(input.userId);
    if (!user) return { completed: false, reason: 'user-not-found' };
    if (!user.activeJob) return { completed: false, reason: 'no-active-job' };

    const job = parseActiveJob(user.activeJob);
    if (!job) return { completed: false, reason: 'invalid-job' };
    if (input.expectedJobIdentity !== undefined && input.expectedJobIdentity !== jobIdentity(job)) {
      return { completed: false, reason: 'job-changed' };
    }
    if (input.mode === 'expired' && input.now < job.endTime) {
      return { completed: false, reason: 'pending' };
    }

    // Only after claiming the user lock may we lock membership/guild rows.
    const guild = await tx.lockGuildForTax(user.id);
    const taxRate = Math.max(0, Number(guild?.taxRate || 0));
    const tax = guild && taxRate > 0 && job.reward > 0
      ? Math.max(1, Math.floor(job.reward * taxRate / 100))
      : 0;
    const boundedTax = Math.min(job.reward, tax);
    const rewardAfterTax = job.reward - boundedTax;
    const money = Number(user.money || 0) + rewardAfterTax;
    const experience = applyJobExp(user, Number(job.expReward || 0));
    const createdAt = new Date(input.now * 1000).toISOString();

    if (guild && boundedTax > 0) {
      await tx.addGuildTax({
        guildId: guild.guildId,
        userId: user.id,
        amount: boundedTax,
        source: 'tax_job',
        createdAt,
      });
    }
    await tx.saveCompletedUser({
      userId: user.id,
      activeJob: null,
      money,
      exp: experience.exp,
      level: experience.level,
      statPoints: experience.statPoints,
      totalJobMoney: Number(user.totalJobMoney || 0) + job.reward,
      totalJobSeconds: Number(user.totalJobSeconds || 0) + job.duration,
    });
    await tx.addHistory({
      userId: user.id,
      jobId: job.jobId,
      jobName: job.name,
      duration: job.duration,
      reward: job.reward,
      startedAt: new Date(job.startTime * 1000).toISOString(),
      premiumBonus: Number(job.premiumBonus || 0),
      xpGained: experience.xpGained,
    });

    return {
      completed: true,
      userId: user.id,
      job,
      grossReward: job.reward,
      tax: boundedTax,
      rewardAfterTax,
      money,
      exp: experience.exp,
      level: experience.level,
      statPoints: experience.statPoints,
      levelsGained: experience.levelsGained,
      xpGained: experience.xpGained,
      guildId: guild?.guildId ?? null,
      oauthProvider: user.oauthProvider ?? null,
      oauthId: user.oauthId ?? null,
    };
  });
}

export async function cancelJob(repository: JobCompletionRepository, input: { userId: number; expectedJobIdentity?: string }): Promise<CancelJobResult> {
  return repository.transaction(async tx => {
    const user = await tx.lockUser(input.userId);
    if (!user) return { cancelled: false, reason: 'user-not-found' };
    if (!user.activeJob) return { cancelled: false, reason: 'no-active-job' };
    const job = parseActiveJob(user.activeJob);
    if (!job) return { cancelled: false, reason: 'invalid-job' };
    if (input.expectedJobIdentity !== undefined && input.expectedJobIdentity !== jobIdentity(job)) return { cancelled: false, reason: 'job-changed' };
    await tx.clearActiveJob(user.id);
    return { cancelled: true, job };
  });
}
