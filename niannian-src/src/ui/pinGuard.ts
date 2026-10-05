let fails = 0;
let lockedUntil = 0;

export function pinLocked(): boolean {
  return Date.now() < lockedUntil;
}

export function notePin(ok: boolean): number {
  if (ok) {
    fails = 0;
    lockedUntil = 0;
    return 0;
  }
  fails += 1;
  if (fails >= 5) {
    fails = 0;
    lockedUntil = Date.now() + 20_000;
    return 20_000;
  }
  return 0;
}
