import { DaySchedule } from "@/types";

// ─── Time math ───────────────────────────────────────────────

/** "HH:mm" → minutes from midnight, null if invalid */
export function timeToMinutes(time: string): number | null {
    if (!time || !time.includes(":")) return null;
    const [h, m] = time.split(":").map(Number);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
}

/** minutes → "HH:mm" */
export function minutesToTime(minutes: number): string {
    const t = Math.max(0, minutes);
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Add minutes to "HH:mm", clamped to 23:59 */
export function addMinutes(time: string, mins: number): string {
    const base = timeToMinutes(time);
    if (base === null) return "";
    return minutesToTime(Math.min(base + mins, 23 * 60 + 59));
}

/**
 * Duration in minutes between start and end "HH:mm".
 * "00:00" as end = midnight = 1440.
 * Returns 0 if invalid or end ≤ start.
 */
export function calcDuration(start: string, end: string): number {
    if (!start || !end) return 0;
    const s = timeToMinutes(start);
    const eRaw = timeToMinutes(end);
    if (s === null || eRaw === null) return 0;
    const e = eRaw === 0 ? 1440 : eRaw;
    return e > s ? e - s : 0;
}

/** Auto work start = lecture end + 1h jeda */
export function autoWorkStart(lectureEnd: string): string {
    return addMinutes(lectureEnd, 60);
}

/** "H:MM" or "HH:MM" display format */
export function formatDuration(minutes: number): string {
    if (minutes <= 0) return "0:00";
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

export type DailyAutoWork = {
    hasSchedule: boolean;
    hasMorning: boolean;
    morningStart: string;
    morningEnd: string;
    morningMins: number;
    eveningStart: string;
    eveningEnd: string;
    eveningMins: number;
    totalMins: number;
};

/** Calculates automatic daily hours, caching at 8 hours max (480 mins) */
export function getDailyAutoWork(sch: DaySchedule | undefined): DailyAutoWork {
    if (!sch?.lectureStart || !sch?.lectureEnd) {
        return {
            hasSchedule: false,
            hasMorning: false,
            morningStart: "",
            morningEnd: "",
            morningMins: 0,
            eveningStart: "",
            eveningEnd: "",
            eveningMins: 0,
            totalMins: 0,
        };
    }

    const hasMorning = sch.lectureStart >= "12:00";
    const morningStart = hasMorning ? "08:00" : "";
    const morningEnd = hasMorning ? "11:30" : "";
    const morningMins = hasMorning ? calcDuration("08:00", "11:30") : 0; // 210

    const eveningStart = autoWorkStart(sch.lectureEnd);
    let eveningMins = calcDuration(eveningStart, "00:00");

    let totalMins = morningMins + eveningMins;
    let eveningEnd = "00:00";

    // Cap at 8 hours (480 mins)
    if (totalMins > 480) {
        eveningMins = Math.max(0, 480 - morningMins);
        totalMins = 480;

        if (eveningMins > 0) {
            const base = timeToMinutes(eveningStart) || 0;
            if (base + eveningMins >= 1440) {
                eveningEnd = "00:00";
            } else {
                eveningEnd = minutesToTime(base + eveningMins);
            }
        } else {
            eveningEnd = eveningStart;
        }
    }

    return {
        hasSchedule: true,
        hasMorning,
        morningStart,
        morningEnd,
        morningMins,
        eveningStart,
        eveningEnd,
        eveningMins,
        totalMins,
    };
}

/** Validate a login/logout pair. Returns error string or null. */
export function validateSession(
    login: string,
    logout: string,
    label: string
): string | null {
    if (!login && !logout) return null;
    if (login && !logout) return `${label}: logout required`;
    if (!login && logout) return `${label}: login required`;
    const s = timeToMinutes(login);
    const eRaw = timeToMinutes(logout);
    if (s === null) return `${label}: invalid login`;
    if (eRaw === null) return `${label}: invalid logout`;
    const e = eRaw === 0 ? 1440 : eRaw;
    if (e <= s) return `${label}: logout must be after login`;
    return null;
}

// ─── ISO week utilities ───────────────────────────────────────

/** Returns "YYYY-Www" for the given date (defaults to today) */
export function getISOWeekKey(date: Date = new Date()): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum); // shift to Thursday
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Returns the Monday and Sunday dates of an ISO week key */
export function getWeekDateRange(weekKey: string): { mon: Date; sun: Date } {
    const [yearStr, wStr] = weekKey.split("-W");
    const year = parseInt(yearStr, 10);
    const week = parseInt(wStr, 10);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7;
    const mon = new Date(jan4);
    mon.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
    const sun = new Date(mon);
    sun.setUTCDate(mon.getUTCDate() + 6);
    return { mon, sun };
}

/** Human-readable label: "Week 9 • Mar 2 – Mar 8, 2026" */
export function weekLabel(weekKey: string): string {
    const [, wStr] = weekKey.split("-W");
    const { mon, sun } = getWeekDateRange(weekKey);
    const fmt = (d: Date) =>
        d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const year = sun.getUTCFullYear();
    return `Week ${parseInt(wStr, 10)} · ${fmt(mon)} – ${fmt(sun)}, ${year}`;
}

/** Returns the key one week before the given weekKey */
export function prevWeekKey(weekKey: string): string {
    const { mon } = getWeekDateRange(weekKey);
    const prev = new Date(mon);
    prev.setUTCDate(mon.getUTCDate() - 1); // last day of prev week
    return getISOWeekKey(new Date(prev.getUTCFullYear(), prev.getUTCMonth(), prev.getUTCDate()));
}

/** Validate and sum a list of work sessions (used by WeeklyTable). */
export function validateAndCalcSessions(
    sessions: Array<{ id: string; loginTime: string; logoutTime: string }>
): { errors: string[]; totalMinutes: number } {
    const errors: string[] = [];
    let totalMinutes = 0;
    sessions.forEach((s, idx) => {
        const err = validateSession(s.loginTime, s.logoutTime, `Sesi ${idx + 1}`);
        if (err) errors.push(err);
        else totalMinutes += calcDuration(s.loginTime, s.logoutTime);
    });
    return { errors, totalMinutes };
}

