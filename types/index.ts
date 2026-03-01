export type DayName =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export const DAYS: DayName[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const DAY_SHORT: Record<DayName, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

/** Lecture schedule per day */
export interface DaySchedule {
  day: DayName;
  lectureStart: string; // "HH:mm"
  lectureEnd: string;   // "HH:mm"
}

/** Manual attendance per day — morning & afternoon sessions */
export interface DayAttendance {
  day: DayName;
  morningIn: string;    // "HH:mm"
  morningOut: string;   // "HH:mm"
  afternoonIn: string;  // "HH:mm"
  afternoonOut: string; // "HH:mm"
}

/** Single week's full data */
export interface WeekRecord {
  weekKey: string;          // "2026-W09"
  schedules: DaySchedule[];
  attendances: DayAttendance[];
  carryOverMinutes: number; // deficit carried from previous week
}

/** Full localStorage data */
export interface AppStorage {
  weeks: Record<string, WeekRecord>; // keyed by weekKey
  theme: "dark" | "light";
}
