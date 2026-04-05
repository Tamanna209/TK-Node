/** Preset keys (rolling window ending at `end`, except 1d = last 24 hours). */
export const ANALYTICS_RANGE_PRESETS = ['1d', '7d', '30d', '90d', '180d'] as const;
export type AnalyticsRangePreset = (typeof ANALYTICS_RANGE_PRESETS)[number];

export interface AnalyticsDateRange {
    start: Date;
    end: Date;
    /** How the window was chosen */
    source: 'preset' | 'custom' | 'default';
    /** Set when source is preset or default rolling window */
    presetKey?: AnalyticsRangePreset;
}

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_HOUR = 60 * 60 * 1000;

function isValidPreset(r: string): r is AnalyticsRangePreset {
    return (ANALYTICS_RANGE_PRESETS as readonly string[]).includes(r);
}

/**
 * Parse YYYY-MM-DD as UTC boundaries, or full ISO datetime.
 * end: last instant of that calendar day in UTC when date-only.
 */
export function parseIsoBoundary(iso: string, boundary: 'start' | 'end'): Date {
    const trimmed = iso.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [y, m, d] = trimmed.split('-').map((x) => parseInt(x, 10));
        if (!y || m < 1 || m > 12 || d < 1 || d > 31) {
            throw new Error(`Invalid date: ${iso}`);
        }
        if (boundary === 'start') {
            return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
        }
        return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
    }

    const dt = new Date(trimmed);
    if (Number.isNaN(dt.getTime())) {
        throw new Error(`Invalid date: ${iso}`);
    }
    return dt;
}

function rollingPresetEnd(): Date {
    return new Date();
}

function computePresetWindow(preset: AnalyticsRangePreset): { start: Date; end: Date } {
    const end = rollingPresetEnd();
    if (preset === '1d') {
        return { start: new Date(end.getTime() - 24 * MS_HOUR), end };
    }
    const days: Record<AnalyticsRangePreset, number> = {
        '1d': 1,
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '180d': 180,
    };
    const n = days[preset];
    return { start: new Date(end.getTime() - n * MS_DAY), end };
}

/**
 * Resolve analytics time window.
 * 1. If `range` is provided → ignore startDate/endDate.
 * 2. Else if both startDate & endDate → custom (UTC; end date is inclusive full day if YYYY-MM-DD).
 * 3. Else → default last 7 days (rolling).
 */
export function getDateRange(
    range?: string | null,
    startDate?: string | null,
    endDate?: string | null
): AnalyticsDateRange {
    const r = range?.trim();

    if (r) {
        if (!isValidPreset(r)) {
            throw new Error(
                `Invalid range "${range}". Use one of: ${ANALYTICS_RANGE_PRESETS.join(', ')}.`
            );
        }
        const { start, end } = computePresetWindow(r);
        return { start, end, source: 'preset', presetKey: r };
    }

    const s = startDate?.trim();
    const e = endDate?.trim();

    if (s && e) {
        const start = parseIsoBoundary(s, 'start');
        const end = parseIsoBoundary(e, 'end');
        if (start.getTime() > end.getTime()) {
            throw new Error('startDate must be before or equal to endDate');
        }
        return { start, end, source: 'custom' };
    }

    if (s || e) {
        throw new Error('Both startDate and endDate are required for a custom range');
    }

    const { start, end } = computePresetWindow('7d');
    return { start, end, source: 'default', presetKey: '7d' };
}

/** Same duration as [start, end], immediately before `start` (for comparisons). */
export function previousPeriodRange(start: Date, end: Date): { prevStart: Date; prevEnd: Date } {
    const len = end.getTime() - start.getTime();
    if (len <= 0) {
        return { prevStart: new Date(start.getTime() - MS_DAY), prevEnd: new Date(start.getTime() - 1) };
    }
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(start.getTime() - len);
    return { prevStart, prevEnd };
}
