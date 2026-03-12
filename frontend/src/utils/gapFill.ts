/**
 * Detect the most common interval between consecutive timestamps (ms).
 * Samples at most the first 96 pairs to stay fast.
 */
export function inferStepMs(sortedIso: string[]): number {
  const counts: Record<number, number> = {};
  for (let i = 1; i < Math.min(sortedIso.length, 96); i++) {
    const d = new Date(sortedIso[i]).getTime() - new Date(sortedIso[i - 1]).getTime();
    if (d > 0) counts[d] = (counts[d] ?? 0) + 1;
  }
  const entries = Object.entries(counts);
  if (!entries.length) return 3_600_000;
  return Number(entries.sort((a, b) => Number(b[1]) - Number(a[1]))[0][0]);
}

/**
 * Fill EVERY missing time step with a sentinel row (only the timestamp key set).
 * This makes a categorical Recharts x-axis visually proportional — a 4-day gap
 * occupies 4× as many axis slots as a 1-day gap.
 *
 * @param rows      Array of data objects, sorted by `tsKey`.
 * @param tsKey     The key holding the ISO timestamp string.
 * @param threshold Multiplier above which a gap triggers sentinel filling (default 1.5).
 */
export function fillAllSteps<T extends Record<string, unknown>>(
  rows: T[],
  tsKey: keyof T,
  threshold = 1.5,
): T[] {
  if (rows.length < 2) return rows;

  const sortedTs = rows.map(r => r[tsKey] as string);
  const stepMs   = inferStepMs(sortedTs);

  const out: T[] = [];
  for (let i = 0; i < rows.length; i++) {
    out.push(rows[i]);
    if (i < rows.length - 1) {
      const curr = new Date(rows[i][tsKey] as string).getTime();
      const next = new Date(rows[i + 1][tsKey] as string).getTime();
      if (next - curr > stepMs * threshold) {
        for (let t = curr + stepMs; t < next - stepMs * 0.5; t += stepMs) {
          out.push({ [tsKey]: new Date(t).toISOString() } as T);
        }
      }
    }
  }
  return out;
}

/**
 * Given a filled (post-fillAllSteps) array, return { x1, x2 } intervals for every
 * contiguous run of "empty" rows — rows that have only the timestamp key set.
 * x1 is the last real row before the run, x2 is the first real row after it.
 */
export function collectGaps<T extends Record<string, unknown>>(
  rows: T[],
  tsKey: keyof T,
): { x1: string; x2: string }[] {
  const gaps: { x1: string; x2: string }[] = [];
  let runStart = -1;
  for (let i = 0; i < rows.length; i++) {
    const isEmpty = Object.keys(rows[i]).length === 1;
    if (isEmpty && runStart === -1) {
      runStart = i;
    } else if (!isEmpty && runStart !== -1) {
      gaps.push({
        x1: String(rows[runStart > 0 ? runStart - 1 : runStart][tsKey]),
        x2: String(rows[i][tsKey]),
      });
      runStart = -1;
    }
  }
  if (runStart !== -1) {
    gaps.push({
      x1: String(rows[runStart > 0 ? runStart - 1 : runStart][tsKey]),
      x2: String(rows[rows.length - 1][tsKey]),
    });
  }
  return gaps;
}

/** @deprecated Use fillAllSteps — fillGaps only inserts one sentinel per gap
 *  which makes gaps look the same size on a categorical x-axis. */
export function fillGaps<T extends Record<string, unknown>>(
  rows: T[],
  tsKey: keyof T,
  threshold = 1.5,
): T[] {
  return fillAllSteps(rows, tsKey, threshold);
}
