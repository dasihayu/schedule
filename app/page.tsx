"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DayName,
  DAYS,
  DAY_SHORT,
  AppStorage,
  WeekRecord,
  DaySchedule,
  DayAttendance,
} from "@/types";
import {
  autoWorkStart,
  calcDuration,
  formatDuration,
  minutesToTime,
  validateSession,
  getISOWeekKey,
  weekLabel,
  prevWeekKey,
} from "@/lib/timeUtils";

// ─── Constants ────────────────────────────────────────────────
const LS_KEY = "worktrack_v2";
const BASE_TARGET = 40 * 60; // minutes

// ─── Default factories ────────────────────────────────────────
function emptySchedules(): DaySchedule[] {
  return DAYS.map((day) => ({ day, lectureStart: "", lectureEnd: "" }));
}
function emptyAttendances(): DayAttendance[] {
  return DAYS.map((day) => ({
    day,
    morningIn: "",
    morningOut: "",
    afternoonIn: "",
    afternoonOut: "",
  }));
}
function createWeek(key: string, carryOver = 0): WeekRecord {
  return {
    weekKey: key,
    schedules: emptySchedules(),
    attendances: emptyAttendances(),
    carryOverMinutes: carryOver,
  };
}

// ─── 24-hour text input ───────────────────────────────────────
function TimeInput({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const format = (raw: string) => {
    const v = raw.trim();
    if (!v) return "";
    let h = 0,
      m = 0;
    if (v.includes(":")) {
      [h, m] = v.split(":").map(Number);
    } else if (v.length >= 3) {
      h = parseInt(v.slice(0, v.length - 2), 10) || 0;
      m = parseInt(v.slice(-2), 10) || 0;
    } else {
      h = parseInt(v, 10) || 0;
    }
    if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59)
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return "";
  };

  return (
    <input
      type="text"
      value={value}
      disabled={disabled}
      placeholder="--:--"
      maxLength={5}
      className="time-input-24"
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => {
        const formatted = format(e.target.value);
        onChange(formatted);
      }}
    />
  );
}

// ─── Sun/Moon icon ────────────────────────────────────────────
function ThemeIcon({ theme }: { theme: "dark" | "light" }) {
  return theme === "dark" ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" />
      <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" />
      <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

// ─── Live Clock ───────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const date = now.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "8px 16px",
        boxShadow: "var(--shadow-sm)",
        marginBottom: 20,
      }}
    >
      {/* Calendar icon */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>

      {/* Day + Date */}
      <div>
        <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
          {dayName}
        </span>
        <span
          style={{
            color: "var(--text-muted)",
            fontSize: "0.82rem",
            marginLeft: 6,
          }}
        >
          {date}
        </span>
      </div>

      {/* Divider */}
      <div
        style={{
          width: 1,
          height: 18,
          background: "var(--border)",
          flexShrink: 0,
        }}
      />

      {/* Clock icon */}
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>

      {/* Time */}
      <span
        style={{
          fontFamily: "ui-monospace, 'Cascadia Code', monospace",
          fontWeight: 700,
          fontSize: "0.95rem",
          color: "var(--primary)",
          letterSpacing: "0.04em",
          minWidth: 72,
        }}
      >
        {time}
      </span>
    </div>
  );
}


// ─── Status pill ──────────────────────────────────────────────
function StatusPill({
  total,
  target,
}: {
  total: number;
  target: number;
}) {
  const diff = total - target;
  if (total === 0)
    return (
      <span style={{ color: "var(--text-subtle)", fontSize: "0.75rem" }}>
        No data yet
      </span>
    );
  if (diff < 0)
    return (
      <span
        style={{
          background: "var(--warning-soft)",
          color: "var(--warning)",
          padding: "2px 10px",
          borderRadius: 99,
          fontSize: "0.75rem",
          fontWeight: 600,
        }}
      >
        {formatDuration(-diff)} short
      </span>
    );
  if (diff === 0)
    return (
      <span
        style={{
          background: "var(--success-soft)",
          color: "var(--success)",
          padding: "2px 10px",
          borderRadius: 99,
          fontSize: "0.75rem",
          fontWeight: 600,
        }}
      >
        ✓ Target met
      </span>
    );
  return (
    <span
      style={{
        background: "var(--sky-soft)",
        color: "var(--sky)",
        padding: "2px 10px",
        borderRadius: 99,
        fontSize: "0.75rem",
        fontWeight: 600,
      }}
    >
      +{formatDuration(diff)} over
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function HomePage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [allWeeks, setAllWeeks] = useState<Record<string, WeekRecord>>({});
  const [viewKey, setViewKey] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  // ── Load from localStorage ──────────────────────────────────
  useEffect(() => {
    const todayKey = getISOWeekKey();
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const stored: AppStorage = JSON.parse(raw);
        // Apply saved theme
        if (stored.theme) setTheme(stored.theme);
        const weeks = stored.weeks || {};

        // Auto-detect & create current week if not exists
        if (!weeks[todayKey]) {
          // Find most recent stored week to compute carry-over
          const sortedKeys = Object.keys(weeks).sort();
          const latestKey = sortedKeys[sortedKeys.length - 1];
          let carryOver = 0;
          if (latestKey) {
            const lw = weeks[latestKey];
            const lwTarget = BASE_TARGET + lw.carryOverMinutes;
            const lwTotal = lw.attendances.reduce((sum, a) => {
              return (
                sum +
                calcDuration(a.morningIn, a.morningOut) +
                calcDuration(a.afternoonIn, a.afternoonOut)
              );
            }, 0);
            carryOver = Math.max(0, lwTarget - lwTotal);
          }
          weeks[todayKey] = createWeek(todayKey, carryOver);
        }
        setAllWeeks(weeks);
      } else {
        // First launch → create current week
        setAllWeeks({ [todayKey]: createWeek(todayKey, 0) });
      }
    } catch (_) {
      setAllWeeks({ [todayKey]: createWeek(todayKey, 0) });
    }
    setViewKey(todayKey);
    setLoaded(true);
  }, []);

  // ── Save to localStorage ────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    const data: AppStorage = { weeks: allWeeks, theme };
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  }, [allWeeks, theme, loaded]);

  // ── Apply theme to <html> ───────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    []
  );

  // ── Derived data ────────────────────────────────────────────
  const todayKey = getISOWeekKey();
  const currentWeek: WeekRecord =
    allWeeks[viewKey] ?? createWeek(viewKey, 0);
  const targetMinutes = BASE_TARGET + currentWeek.carryOverMinutes;
  const isCurrentWeek = viewKey === todayKey;

  const sortedKeys = Object.keys(allWeeks).sort();
  const viewIdx = sortedKeys.indexOf(viewKey);

  const dailyTotals = DAYS.map((day) => {
    const a = currentWeek.attendances.find((x) => x.day === day)!;
    if (!a) return 0;
    return (
      calcDuration(a.morningIn, a.morningOut) +
      calcDuration(a.afternoonIn, a.afternoonOut)
    );
  });
  const weeklyTotal = dailyTotals.reduce((s, v) => s + v, 0);
  const diff = weeklyTotal - targetMinutes;
  const progressPct = Math.min(100, (weeklyTotal / targetMinutes) * 100);

  const progressColor =
    weeklyTotal === 0
      ? "var(--text-subtle)"
      : diff < 0
        ? "var(--warning)"
        : diff === 0
          ? "var(--success)"
          : "var(--sky)";

  // ── Week navigation ─────────────────────────────────────────
  const goToPrev = useCallback(() => {
    if (viewIdx > 0) setViewKey(sortedKeys[viewIdx - 1]);
  }, [viewIdx, sortedKeys]);

  const goToNext = useCallback(() => {
    if (viewIdx < sortedKeys.length - 1)
      setViewKey(sortedKeys[viewIdx + 1]);
  }, [viewIdx, sortedKeys]);

  const goToCurrent = useCallback(() => setViewKey(todayKey), [todayKey]);

  // ── Updaters ────────────────────────────────────────────────
  const updateWeek = useCallback(
    (updater: (prev: WeekRecord) => WeekRecord) => {
      setAllWeeks((prev) => ({
        ...prev,
        [viewKey]: updater(prev[viewKey] ?? createWeek(viewKey, 0)),
      }));
    },
    [viewKey]
  );

  const updateSchedule = useCallback(
    (day: DayName, field: keyof Omit<DaySchedule, "day">, val: string) => {
      updateWeek((w) => ({
        ...w,
        schedules: w.schedules.map((s) =>
          s.day === day ? { ...s, [field]: val } : s
        ),
      }));
    },
    [updateWeek]
  );

  const updateAttendance = useCallback(
    (day: DayName, field: keyof Omit<DayAttendance, "day">, val: string) => {
      updateWeek((w) => ({
        ...w,
        attendances: w.attendances.map((a) =>
          a.day === day ? { ...a, [field]: val } : a
        ),
      }));
    },
    [updateWeek]
  );

  const handleReset = useCallback(() => {
    if (confirm("Reset this week's data?")) {
      updateWeek((w) => ({
        ...createWeek(w.weekKey, w.carryOverMinutes),
      }));
    }
  }, [updateWeek]);

  if (!loaded) {
    return (
      <div
        data-theme={theme}
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            border: "2px solid var(--primary)",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div
      data-theme={theme}
      suppressHydrationWarning
      style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="max-w-5xl mx-auto px-4 py-8" style={{ maxWidth: 900 }}>

        {/* ── Live Clock ──────────────────────────────────────── */}
        <LiveClock />

        {/* ── Header ─────────────────────────────────────────── */}
        <header className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                marginBottom: 2,
              }}
            >
              Work Attendance
            </h1>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Track your weekly work hours · auto-saved
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {!isCurrentWeek && (
              <button className="btn-week-nav" onClick={goToCurrent}>
                Go to current
              </button>
            )}

            <button onClick={toggleTheme} className="btn-theme">
              <ThemeIcon theme={theme} />
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button
              onClick={handleReset}
              style={{
                fontSize: "0.75rem",
                color: "var(--text-subtle)",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              Reset
            </button>
          </div>
        </header>

        {/* ── Week navigation ─────────────────────────────────── */}
        <div
          className="flex items-center justify-between mb-5"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "10px 16px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <button
            className="btn-week-nav"
            onClick={goToPrev}
            disabled={viewIdx <= 0}
          >
            ← Prev
          </button>

          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: 600, fontSize: "0.9rem" }}>
              {viewKey ? weekLabel(viewKey) : "—"}
            </p>
            {isCurrentWeek && (
              <span
                style={{
                  fontSize: "0.68rem",
                  background: "var(--primary-soft)",
                  color: "var(--primary)",
                  borderRadius: 99,
                  padding: "1px 8px",
                  fontWeight: 600,
                }}
              >
                Current Week
              </span>
            )}
          </div>

          <button
            className="btn-week-nav"
            onClick={goToNext}
            disabled={viewIdx >= sortedKeys.length - 1}
          >
            Next →
          </button>
        </div>

        {/* ── Carry-over banner ───────────────────────────────── */}
        {currentWeek.carryOverMinutes > 0 && (
          <div
            style={{
              background: "var(--warning-soft)",
              border: "1px solid color-mix(in srgb, var(--warning) 25%, transparent)",
              borderRadius: 12,
              padding: "10px 16px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: "0.82rem",
              color: "var(--warning)",
            }}
          >
            <span style={{ fontSize: "1rem" }}>↩</span>
            <div>
              <strong>{minutesToTime(currentWeek.carryOverMinutes)}</strong>{" "}
              carried over from previous week
              <span
                style={{ color: "var(--text-muted)", marginLeft: 8 }}
              >
                Target: 40:00 + {minutesToTime(currentWeek.carryOverMinutes)} ={" "}
                <strong style={{ color: "var(--warning)" }}>
                  {minutesToTime(targetMinutes)}
                </strong>
              </span>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            ATTENDANCE TABLE
        ══════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 28 }}>
          <p className="section-title">
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--primary)",
                display: "inline-block",
              }}
            />
            Attendance
          </p>

          <div className="app-card">
            <div style={{ overflowX: "auto" }}>
              <table className="app-table">
                <thead>
                  <tr>
                    <th className="day-col">Day</th>
                    <th>Morning In</th>
                    <th>Morning Out</th>
                    <th>Afternoon In</th>
                    <th>Afternoon Out</th>
                    <th style={{ color: "var(--primary)" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day, idx) => {
                    const a = currentWeek.attendances.find(
                      (x) => x.day === day
                    )!;
                    const total = dailyTotals[idx];
                    const errMorn = validateSession(
                      a?.morningIn,
                      a?.morningOut,
                      "AM"
                    );
                    const errAftn = validateSession(
                      a?.afternoonIn,
                      a?.afternoonOut,
                      "PM"
                    );

                    return (
                      <tr key={day}>
                        <td className="day-col">
                          <span>{DAY_SHORT[day]}</span>
                          {(errMorn || errAftn) && (
                            <div style={{ marginTop: 2 }}>
                              {errMorn && (
                                <div
                                  style={{
                                    fontSize: "0.68rem",
                                    color: "var(--danger)",
                                  }}
                                >
                                  ⚠ {errMorn}
                                </div>
                              )}
                              {errAftn && (
                                <div
                                  style={{
                                    fontSize: "0.68rem",
                                    color: "var(--danger)",
                                  }}
                                >
                                  ⚠ {errAftn}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <TimeInput
                            value={a?.morningIn ?? ""}
                            onChange={(v) =>
                              updateAttendance(day, "morningIn", v)
                            }
                          />
                        </td>
                        <td>
                          <TimeInput
                            value={a?.morningOut ?? ""}
                            onChange={(v) =>
                              updateAttendance(day, "morningOut", v)
                            }
                          />
                        </td>
                        <td>
                          <TimeInput
                            value={a?.afternoonIn ?? ""}
                            onChange={(v) =>
                              updateAttendance(day, "afternoonIn", v)
                            }
                          />
                        </td>
                        <td>
                          <TimeInput
                            value={a?.afternoonOut ?? ""}
                            onChange={(v) =>
                              updateAttendance(day, "afternoonOut", v)
                            }
                          />
                        </td>
                        <td>
                          <span
                            style={{
                              fontFamily: "ui-monospace, monospace",
                              fontWeight: 600,
                              fontSize: "0.85rem",
                              color:
                                total > 0
                                  ? "var(--primary)"
                                  : "var(--text-subtle)",
                            }}
                          >
                            {formatDuration(total)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--surface-2)" }}>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        color: "var(--text-muted)",
                        fontWeight: 500,
                        fontSize: "0.78rem",
                      }}
                    >
                      Weekly Total
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          fontWeight: 700,
                          fontSize: "1rem",
                        }}
                      >
                        {formatDuration(weeklyTotal)}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        color: "var(--text-muted)",
                        fontSize: "0.78rem",
                      }}
                    >
                      Status
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <StatusPill total={weeklyTotal} target={targetMinutes} />
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        color: "var(--text-subtle)",
                        fontSize: "0.75rem",
                      }}
                    >
                      Target
                      {currentWeek.carryOverMinutes > 0 && (
                        <span style={{ marginLeft: 6, color: "var(--warning)" }}>
                          (40:00 + {minutesToTime(currentWeek.carryOverMinutes)}{" "}
                          carry-over)
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          fontFamily: "ui-monospace, monospace",
                          fontWeight: 700,
                          color: "var(--text-muted)",
                          fontSize: "0.9rem",
                        }}
                      >
                        {minutesToTime(targetMinutes)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Progress */}
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid var(--border-soft)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.72rem",
                  color: "var(--text-subtle)",
                  marginBottom: 6,
                }}
              >
                <span>Progress this week</span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${progressPct}%`,
                    background: progressColor,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            SCHEDULE TABLE
        ══════════════════════════════════════════════════════ */}
        <section>
          <p className="section-title">
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--success)",
                display: "inline-block",
              }}
            />
            Schedule
          </p>
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--text-subtle)",
              marginBottom: 10,
            }}
          >
            Enter lecture hours → work start auto-calculated (lecture end + 1h
            buffer, until 00:00)
          </p>

          <div className="app-card">
            <div style={{ overflowX: "auto" }}>
              <table className="app-table">
                <thead>
                  <tr>
                    <th
                      className="day-col"
                      rowSpan={2}
                      style={{ verticalAlign: "middle" }}
                    >
                      Day
                    </th>
                    <th colSpan={2} className="group-lecture">
                      Lecture
                    </th>
                    <th colSpan={2} className="group-work">
                      Work (Auto)
                    </th>
                  </tr>
                  <tr>
                    <th>Start</th>
                    <th>End</th>
                    <th>Work Start</th>
                    <th>Work End</th>
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((day) => {
                    const sch = currentWeek.schedules.find(
                      (s) => s.day === day
                    )!;
                    const hasSchedule =
                      !!sch?.lectureStart && !!sch?.lectureEnd;
                    const workStart = hasSchedule
                      ? autoWorkStart(sch.lectureEnd)
                      : "";

                    return (
                      <tr key={day}>
                        <td className="day-col">{DAY_SHORT[day]}</td>
                        <td>
                          <TimeInput
                            value={sch?.lectureStart ?? ""}
                            onChange={(v) =>
                              updateSchedule(day, "lectureStart", v)
                            }
                          />
                        </td>
                        <td>
                          <TimeInput
                            value={sch?.lectureEnd ?? ""}
                            onChange={(v) =>
                              updateSchedule(day, "lectureEnd", v)
                            }
                          />
                        </td>
                        <td>
                          {hasSchedule ? (
                            <span className="auto-badge">{workStart}</span>
                          ) : (
                            <span style={{ color: "var(--text-subtle)" }}>–</span>
                          )}
                        </td>
                        <td>
                          {hasSchedule ? (
                            <span className="auto-badge">00:00</span>
                          ) : (
                            <span style={{ color: "var(--text-subtle)" }}>–</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div
              style={{
                padding: "8px 16px",
                borderTop: "1px solid var(--border-soft)",
                fontSize: "0.72rem",
                color: "var(--text-subtle)",
              }}
            >
              💡 Work start = lecture end + 1 hour buffer · Work end = 00:00
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer
          style={{
            marginTop: 32,
            textAlign: "center",
            fontSize: "0.7rem",
            color: "var(--text-subtle)",
          }}
        >
          Data saved automatically · {sortedKeys.length} week
          {sortedKeys.length !== 1 ? "s" : ""} stored
        </footer>
      </div>
    </div>
  );
}
