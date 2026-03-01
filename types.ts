// ─── Shared Types ──────────────────────────────────────────────────────────

export type DayName =
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday";

export const DAYS: DayName[] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
];

export const DAY_SHORT: Record<DayName, string> = {
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
};

// ─── Schedule (lecture timetable per day) ──────────────────────────────────

export interface DaySchedule {
    day: DayName;
    lectureStart: string;
    lectureEnd: string;
}

// ─── Attendance (work clock-in/out per day) ────────────────────────────────

export interface DayAttendance {
    day: DayName;
    morningIn: string;
    morningOut: string;
    afternoonIn: string;
    afternoonOut: string;
}

// ─── Week record ───────────────────────────────────────────────────────────

export interface WeekRecord {
    weekKey: string;
    schedules: DaySchedule[];
    attendances: DayAttendance[];
    carryOverMinutes: number;
}

// ─── Legacy: DayRecord (used by WeeklyTable) ───────────────────────────────
// Kept for backwards-compatibility with WeeklyTable.tsx.

export interface WorkSession {
    id: string;
    loginTime: string;
    logoutTime: string;
}

export type ScheduleType = "Biasa" | "Spesial";

export interface DayRecord {
    day: DayName;
    lectureStart: string;
    lectureEnd: string;
    workSessions: WorkSession[];
    scheduleType: ScheduleType;
    description?: string;
}
