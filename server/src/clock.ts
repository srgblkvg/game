export type Clock = {
  nowMs(): number;
  nowSec(): number;
};

export function nowSecFromMs(nowMs: number): number {
  return Math.floor(nowMs / 1000);
}

export const systemClock: Clock = {
  nowMs: () => Date.now(),
  nowSec: () => nowSecFromMs(Date.now()),
};
