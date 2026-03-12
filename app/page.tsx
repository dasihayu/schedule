"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  DayName,
  DAYS,
  DAY_SHORT,
  WeekRecord,
  DaySchedule,
  DayAttendance,
  ALL_DAYS,
} from "@/types";
import {
  calcDuration,
  formatDuration,
  minutesToTime,
  validateSession,
  getISOWeekKey,
  weekLabel,
  getDailyAutoWork,
} from "@/lib/timeUtils";

// ─── Constants ────────────────────────────────────────────────
const BASE_TARGET = 40 * 60; // minutes

// ─── Default factories ────────────────────────────────────────
function emptySchedules(): DaySchedule[] {
  return DAYS.map((day: DayName) => ({
    day,
    lectureStart: "",
    lectureEnd: "",
  }));
}
function emptyAttendances(): DayAttendance[] {
  return ALL_DAYS.map((day: DayName) => ({
    day,
    morningIn: "",
    morningOut: "",
    afternoonIn: "",
    afternoonOut: "",
  }));
}
function createWeek(
  key: string,
  carryOver = 0,
  targetMinutes = BASE_TARGET,
): WeekRecord {
  return {
    weekKey: key,
    schedules: emptySchedules(),
    attendances: emptyAttendances(),
    carryOverMinutes: carryOver,
    targetMinutes,
  };
}

function TimeInput({
  value,
  onChange,
  onBlur,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: (v: string) => void;
  disabled?: boolean;
}) {
  const sanitize = (raw: string) => {
    const cleaned = raw.replace(/[^\d:]/g, "");
    const firstColon = cleaned.indexOf(":");
    if (firstColon === -1) return cleaned.slice(0, 5);

    const hourPart = cleaned.slice(0, firstColon).replace(/:/g, "");
    const minutePart = cleaned.slice(firstColon + 1).replace(/:/g, "");
    return `${hourPart}:${minutePart}`.slice(0, 5);
  };

  const format = (raw: string) => {
    const v = sanitize(raw);
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
      m = 0;
    }
    if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 99 && m >= 0 && m <= 59)
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    return "";
  };

  const normalizedValue = sanitize(value);

  return (
    <input
      type="text"
      value={normalizedValue}
      disabled={disabled}
      placeholder="--:--"
      maxLength={5}
      inputMode="numeric"
      autoComplete="off"
      className="time-input-24"
      onChange={(e) => onChange(sanitize(e.target.value))}
      onBlur={(e) => {
        const formatted = format(e.target.value);
        onChange(formatted);
        if (onBlur) onBlur(formatted);
      }}
    />
  );
}

// ─── Sun/Moon icon ────────────────────────────────────────────
function ThemeIcon({ theme }: { theme: "dark" | "light" }) {
  return theme === "dark" ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
      <line
        x1="12"
        y1="1"
        x2="12"
        y2="3"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="12"
        y1="21"
        x2="12"
        y2="23"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="4.22"
        y1="4.22"
        x2="5.64"
        y2="5.64"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="18.36"
        y1="18.36"
        x2="19.78"
        y2="19.78"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="1"
        y1="12"
        x2="3"
        y2="12"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="21"
        y1="12"
        x2="23"
        y2="12"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="4.22"
        y1="19.78"
        x2="5.64"
        y2="18.36"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="18.36"
        y1="5.64"
        x2="19.78"
        y2="4.22"
        stroke="currentColor"
        strokeWidth="2"
      />
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
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "8px 18px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>

      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "0.84rem",
          color: "var(--text)",
          letterSpacing: "0.01em",
        }}
      >
        {dayName}
      </span>
      <span style={{ color: "var(--text-subtle)", fontSize: "0.8rem" }}>
        {date}
      </span>

      <div
        style={{
          width: 1,
          height: 16,
          background: "var(--border)",
          flexShrink: 0,
        }}
      />

      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-subtle)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>

      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize: "0.92rem",
          color: "var(--primary)",
          letterSpacing: "0.06em",
          minWidth: 68,
        }}
      >
        {time}
      </span>
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────
function StatusPill({ total, target }: { total: number; target: number }) {
  const diff = total - target;
  const baseStyle: React.CSSProperties = {
    padding: "3px 10px",
    borderRadius: "var(--radius-pill)",
    fontSize: "0.72rem",
    fontWeight: 700,
    fontFamily: "var(--font-display)",
    letterSpacing: "0.04em",
    display: "inline-block",
  };

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
          ...baseStyle,
          background: "var(--warning-soft)",
          color: "var(--warning)",
        }}
      >
        {formatDuration(-diff)} short
      </span>
    );
  if (diff === 0)
    return (
      <span
        style={{
          ...baseStyle,
          background: "var(--success-soft)",
          color: "var(--success)",
        }}
      >
        ✓ Target met
      </span>
    );
  return (
    <span
      style={{
        ...baseStyle,
        background: "var(--sky-soft)",
        color: "var(--sky)",
      }}
    >
      +{formatDuration(diff)} over
    </span>
  );
}

// ─── Carry-over Input ─────────────────────────────────────────
function CarryOverInput({
  carryOverMinutes,
  updateWeek,
}: {
  carryOverMinutes: number;
  updateWeek: (updater: (prev: WeekRecord) => WeekRecord) => void;
}) {
  const [localVal, setLocalVal] = useState(minutesToTime(carryOverMinutes));

  useEffect(() => {
    setLocalVal(minutesToTime(carryOverMinutes));
  }, [carryOverMinutes]);

  const commitChanges = (val: string) => {
    let totalMins = 0;
    if (val.includes(":")) {
      const [h, m] = val.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) totalMins = h * 60 + m;
    }
    updateWeek((w) => ({ ...w, carryOverMinutes: totalMins }));
    setLocalVal(minutesToTime(totalMins));
  };

  return (
    <TimeInput value={localVal} onChange={setLocalVal} onBlur={commitChanges} />
  );
}

// ─── Target Input ─────────────────────────────────────────────
function TargetInput({
  targetMinutes,
  updateWeek,
}: {
  targetMinutes: number;
  updateWeek: (updater: (prev: WeekRecord) => WeekRecord) => void;
}) {
  const [localVal, setLocalVal] = useState(minutesToTime(targetMinutes));

  useEffect(() => {
    setLocalVal(minutesToTime(targetMinutes));
  }, [targetMinutes]);

  const commitChanges = (val: string) => {
    let totalMins = 0;
    if (val.includes(":")) {
      const [h, m] = val.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) totalMins = h * 60 + m;
    }
    updateWeek((w) => ({ ...w, targetMinutes: totalMins }));
    setLocalVal(minutesToTime(totalMins));
  };

  return (
    <TimeInput value={localVal} onChange={setLocalVal} onBlur={commitChanges} />
  );
}

// ─── Nav Link / Action Button helpers ────────────────────────
function ActionBtn({
  children,
  onClick,
  color = "default",
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  color?: "default" | "primary" | "success" | "danger";
  href?: string;
}) {
  const colorMap = {
    default: {
      color: "var(--text-muted)",
      bg: "var(--surface-2)",
      border: "var(--border)",
    },
    primary: {
      color: "var(--primary)",
      bg: "var(--primary-soft)",
      border: "var(--primary-ring)",
    },
    success: {
      color: "var(--success)",
      bg: "var(--success-soft)",
      border: "rgba(45,125,70,0.2)",
    },
    danger: {
      color: "var(--danger)",
      bg: "var(--danger-soft)",
      border: "rgba(191,32,32,0.2)",
    },
  };
  const style: React.CSSProperties = {
    fontSize: "0.75rem",
    fontWeight: 600,
    fontFamily: "var(--font-display)",
    letterSpacing: "0.03em",
    color: colorMap[color].color,
    background: colorMap[color].bg,
    border: `1px solid ${colorMap[color].border}`,
    borderRadius: "var(--radius)",
    padding: "6px 12px",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    transition: "opacity 0.12s, transform 0.1s",
    whiteSpace: "nowrap",
  };

  if (href)
    return (
      <a href={href} style={style}>
        {children}
      </a>
    );
  return (
    <button
      onClick={onClick}
      style={style}
      onMouseOver={(e) => {
        e.currentTarget.style.opacity = "0.82";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.opacity = "1";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {children}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [allWeeks, setAllWeeks] = useState<Record<string, WeekRecord>>({});
  const [viewKey, setViewKey] = useState<string>("");
  const [scheduleTab, setScheduleTab] = useState<"lecture" | "working">(
    "lecture",
  );
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    const t = localStorage.getItem("worktrack_theme") as
      | "dark"
      | "light"
      | null;
    if (t) setTheme(t);
    else if (window.matchMedia("(prefers-color-scheme: light)").matches)
      setTheme("light");
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    const todayKey = getISOWeekKey();

    fetch("/api/weeks")
      .then((r) => r.json())
      .then(({ weeks: records }) => {
        if (records && records.length > 0) {
          const weeks: Record<string, WeekRecord> = {};
          for (const rec of records) {
            const rawAttendances = Array.isArray(rec.attendances)
              ? rec.attendances
              : [];
            const fullAttendances = ALL_DAYS.map(
              (day: DayName) =>
                rawAttendances.find((a: any) => a.day === day) || {
                  day,
                  morningIn: "",
                  morningOut: "",
                  afternoonIn: "",
                  afternoonOut: "",
                },
            );
            const rawSchedules = Array.isArray(rec.schedules)
              ? rec.schedules
              : [];
            const fullSchedules = DAYS.map(
              (day: DayName) =>
                rawSchedules.find((s: any) => s.day === day) || {
                  day,
                  lectureStart: "",
                  lectureEnd: "",
                },
            );
            weeks[rec.weekKey] = {
              weekKey: rec.weekKey,
              carryOverMinutes: rec.carryOverMinutes,
              schedules: fullSchedules,
              attendances: fullAttendances,
              targetMinutes: rec.targetMinutes ?? BASE_TARGET,
            };
          }
          if (!weeks[todayKey]) {
            const sortedKeys = Object.keys(weeks).sort();
            const latestKey = sortedKeys[sortedKeys.length - 1];
            let carryOver = 0;
            let copiedSchedules: DaySchedule[] | undefined;
            if (latestKey) {
              const lw = weeks[latestKey];
              const lwTarget = BASE_TARGET + lw.carryOverMinutes;
              const lwTotal = lw.attendances.reduce(
                (sum: number, a: DayAttendance) =>
                  sum +
                  calcDuration(a.morningIn, a.morningOut) +
                  calcDuration(a.afternoonIn, a.afternoonOut),
                0,
              );
              carryOver = Math.max(0, lwTarget - lwTotal);
              copiedSchedules = lw.schedules.map((s) => ({ ...s }));
            }
            const newWeek = createWeek(todayKey, carryOver);
            if (copiedSchedules) newWeek.schedules = copiedSchedules;
            weeks[todayKey] = newWeek;
          }
          setAllWeeks(weeks);
        } else {
          setAllWeeks({ [todayKey]: createWeek(todayKey, 0) });
        }
        setViewKey(todayKey);
        setLoaded(true);
      })
      .catch(() => {
        setAllWeeks({ [todayKey]: createWeek(todayKey, 0) });
        setViewKey(todayKey);
        setLoaded(true);
      });
  }, [status]);

  const saveWeek = useCallback((weekKey: string, week: WeekRecord) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch("/api/weeks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekKey: week.weekKey,
            carryOverMinutes: week.carryOverMinutes,
            targetMinutes: week.targetMinutes,
            schedules: week.schedules,
            attendances: week.attendances,
          }),
        });
      } finally {
        setSaving(false);
      }
    }, 1500);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("worktrack_theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [],
  );

  const todayKey = getISOWeekKey();
  const currentWeek: WeekRecord = allWeeks[viewKey] ?? createWeek(viewKey, 0);
  const targetMinutes =
    currentWeek.targetMinutes + currentWeek.carryOverMinutes;
  const isCurrentWeek = viewKey === todayKey;
  const sortedKeys = Object.keys(allWeeks).sort();
  const viewIdx = sortedKeys.indexOf(viewKey);

  const dailyTotals = ALL_DAYS.map((day: DayName) => {
    const a = currentWeek.attendances.find((x) => x.day === day);
    if (!a) return 0;
    return (
      calcDuration(a.morningIn, a.morningOut) +
      calcDuration(a.afternoonIn, a.afternoonOut)
    );
  });
  const weeklyTotal = dailyTotals.reduce((s: number, v: number) => s + v, 0);
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

  const monFriWorkMins = DAYS.reduce((sum, day) => {
    const sch = currentWeek.schedules.find((s) => s.day === day);
    return sum + getDailyAutoWork(sch).totalMins;
  }, 0);

  let remaining = Math.max(0, targetMinutes - monFriWorkMins);
  const satMins = Math.min(8 * 60, remaining);
  remaining -= satMins;
  const sunMins = Math.min(8 * 60, remaining);

  const weekendSchedule = [
    { day: "Saturday", short: "Sat", workMins: satMins },
    { day: "Sunday", short: "Sun", workMins: sunMins },
  ];

  const goToPrev = useCallback(() => {
    if (viewIdx > 0) setViewKey(sortedKeys[viewIdx - 1]);
  }, [viewIdx, sortedKeys]);
  const goToNext = useCallback(() => {
    if (viewIdx < sortedKeys.length - 1) setViewKey(sortedKeys[viewIdx + 1]);
  }, [viewIdx, sortedKeys]);
  const goToCurrent = useCallback(() => setViewKey(todayKey), [todayKey]);

  const updateWeek = useCallback(
    (updater: (prev: WeekRecord) => WeekRecord) => {
      setAllWeeks((prev) => {
        const updated = updater(prev[viewKey] ?? createWeek(viewKey, 0));
        saveWeek(viewKey, updated);
        return { ...prev, [viewKey]: updated };
      });
    },
    [viewKey, saveWeek],
  );

  const updateSchedule = useCallback(
    (day: DayName, field: keyof Omit<DaySchedule, "day">, val: string) => {
      updateWeek((w) => {
        const hasDay = w.schedules.some((s) => s.day === day);
        if (!hasDay)
          return {
            ...w,
            schedules: [
              ...w.schedules,
              { day, lectureStart: "", lectureEnd: "", [field]: val },
            ],
          };
        return {
          ...w,
          schedules: w.schedules.map((s) =>
            s.day === day ? { ...s, [field]: val } : s,
          ),
        };
      });
    },
    [updateWeek],
  );

  const updateAttendance = useCallback(
    (day: DayName, field: keyof Omit<DayAttendance, "day">, val: string) => {
      updateWeek((w) => {
        const hasDay = w.attendances.some((a) => a.day === day);
        if (!hasDay)
          return {
            ...w,
            attendances: [
              ...w.attendances,
              {
                day,
                morningIn: "",
                morningOut: "",
                afternoonIn: "",
                afternoonOut: "",
                [field]: val,
              },
            ],
          };
        return {
          ...w,
          attendances: w.attendances.map((a) =>
            a.day === day ? { ...a, [field]: val } : a,
          ),
        };
      });
    },
    [updateWeek],
  );

  const handleReset = useCallback(() => {
    setConfirmState({
      isOpen: true,
      title: "Reset Week",
      message: "Reset all data for this week? This cannot be undone.",
      onConfirm: () => {
        updateWeek((w) => ({ ...createWeek(w.weekKey, w.carryOverMinutes) }));
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }, [updateWeek]);

  const handleClearAttendance = useCallback(() => {
    setConfirmState({
      isOpen: true,
      title: "Clear Attendance",
      message: "Clear all attendance entries for this week?",
      onConfirm: () => {
        updateWeek((w) => ({
          ...w,
          attendances: ALL_DAYS.map((day: DayName) => ({
            day,
            morningIn: "",
            morningOut: "",
            afternoonIn: "",
            afternoonOut: "",
          })),
        }));
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
      },
    });
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
            width: 36,
            height: 36,
            border: "2px solid var(--border)",
            borderTopColor: "var(--primary)",
            borderRadius: "50%",
            animation: "spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite",
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Shared tab button style ───────────────────────────────
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "5px 14px",
    fontSize: "0.78rem",
    fontWeight: active ? 700 : 500,
    fontFamily: "var(--font-display)",
    letterSpacing: "0.02em",
    borderRadius: "var(--radius)",
    background: active ? "var(--surface)" : "transparent",
    color: active
      ? scheduleTab === "working"
        ? "var(--primary)"
        : "var(--text)"
      : "var(--text-muted)",
    border: "none",
    cursor: "pointer",
    transition: "background 0.12s, color 0.12s",
    boxShadow: active ? "var(--shadow-sm)" : "none",
  });

  return (
    <div data-theme={theme} suppressHydrationWarning>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div
        style={{ maxWidth: 960, margin: "0 auto", padding: "36px 20px 60px" }}
      >
        {/* ── Live Clock ─────────────────────────────────── */}
        <div
          style={{
            marginBottom: "2rem",
            display: "flex",
            justifyContent: "center",
            animation: "fadeInUp 0.4s ease",
          }}
        >
          <LiveClock />
        </div>

        {/* ── Header ─────────────────────────────────────── */}
        <header
          className="app-card"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 20,
            padding: "16px 20px",
            animation: "fadeInUp 0.4s ease 0.05s both",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.25rem",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                margin: 0,
                marginBottom: 2,
                color: "var(--text)",
                fontFamily: "var(--font-display)",
                lineHeight: 1.2,
              }}
            >
              Work Attendance
            </h1>
            <p
              style={{
                fontSize: "0.78rem",
                color: "var(--text-subtle)",
                margin: 0,
                fontWeight: 400,
              }}
            >
              Track weekly hours · Auto-saved
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {session?.user?.name && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  padding: "5px 10px",
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  maxWidth: 140,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontFamily: "var(--font-display)",
                  fontWeight: 500,
                }}
              >
                {session.user.name}
              </span>
            )}

            {saving && (
              <span
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-subtle)",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: "var(--font-mono)",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    border: "1.5px solid var(--primary)",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                saving…
              </span>
            )}

            {!isCurrentWeek && (
              <ActionBtn onClick={goToCurrent} color="primary">
                ↩ Current
              </ActionBtn>
            )}

            <button onClick={toggleTheme} className="btn-theme">
              <ThemeIcon theme={theme} />
              {theme === "dark" ? "Light" : "Dark"}
            </button>

            <ActionBtn href="/tasks" color="primary">
              Tasks
            </ActionBtn>
            <ActionBtn onClick={() => setShowReportModal(true)} color="success">
              Report
            </ActionBtn>
            <ActionBtn
              onClick={() => signOut({ callbackUrl: "/login" })}
              color="danger"
            >
              Sign Out
            </ActionBtn>
          </div>
        </header>

        {/* ── Week navigation ─────────────────────────────── */}
        <div
          className="app-card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
            padding: "12px 16px",
            animation: "fadeInUp 0.4s ease 0.08s both",
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
            <p
              style={{
                fontWeight: 700,
                fontSize: "0.88rem",
                margin: 0,
                fontFamily: "var(--font-display)",
                letterSpacing: "0.01em",
              }}
            >
              {viewKey ? weekLabel(viewKey) : "—"}
            </p>
            {isCurrentWeek && (
              <span
                style={{
                  display: "inline-block",
                  marginTop: 4,
                  fontSize: "0.63rem",
                  background: "var(--primary)",
                  color: "#fff",
                  borderRadius: "var(--radius-pill)",
                  padding: "2px 10px",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  fontFamily: "var(--font-display)",
                  textTransform: "uppercase",
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

        {/* ── Carry-over banner ───────────────────────────── */}
        {currentWeek.carryOverMinutes > 0 && (
          <div
            style={{
              background: "var(--warning-soft)",
              border: "1px solid var(--border)",
              borderLeft: "3px solid var(--warning)",
              borderRadius: "var(--radius-lg)",
              padding: "10px 16px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: "0.83rem",
              color: "var(--warning)",
              animation: "fadeInUp 0.3s ease",
            }}
          >
            <span style={{ fontSize: "1rem" }}>↩</span>
            <div>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                {minutesToTime(currentWeek.carryOverMinutes)}
              </span>{" "}
              <span style={{ color: "var(--text-muted)" }}>
                carried over · Target:
              </span>{" "}
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                {minutesToTime(targetMinutes)}
              </span>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            ATTENDANCE TABLE
        ══════════════════════════════════════════════ */}
        <section
          style={{
            marginBottom: 24,
            animation: "fadeInUp 0.4s ease 0.1s both",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <p className="section-title" style={{ margin: 0 }}>
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--primary)",
                  display: "inline-block",
                }}
              />
              Attendance
            </p>
            <button
              onClick={handleClearAttendance}
              style={{
                fontSize: "0.72rem",
                color: "var(--danger)",
                background: "transparent",
                border: "1px solid rgba(191,32,32,0.2)",
                borderRadius: "var(--radius)",
                padding: "4px 10px",
                cursor: "pointer",
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                letterSpacing: "0.03em",
                transition: "background 0.12s, border-color 0.12s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "var(--danger-soft)";
                e.currentTarget.style.borderColor = "var(--danger)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(191,32,32,0.2)";
              }}
            >
              Clear
            </button>
          </div>

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
                  {ALL_DAYS.map((day: DayName, idx: number) => {
                    const a = currentWeek.attendances.find(
                      (x) => x.day === day,
                    );
                    const total = dailyTotals[idx];
                    const errMorn = validateSession(
                      a?.morningIn || "",
                      a?.morningOut || "",
                      "AM",
                    );
                    const errAftn = validateSession(
                      a?.afternoonIn || "",
                      a?.afternoonOut || "",
                      "PM",
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
                                    fontSize: "0.65rem",
                                    color: "var(--danger)",
                                    fontFamily: "var(--font-mono)",
                                  }}
                                >
                                  ⚠ {errMorn}
                                </div>
                              )}
                              {errAftn && (
                                <div
                                  style={{
                                    fontSize: "0.65rem",
                                    color: "var(--danger)",
                                    fontFamily: "var(--font-mono)",
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
                              fontFamily: "var(--font-mono)",
                              fontWeight: total > 0 ? 500 : 400,
                              fontSize: "0.84rem",
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
                        color: "var(--text-subtle)",
                        fontWeight: 600,
                        fontSize: "0.72rem",
                        fontFamily: "var(--font-display)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Weekly Total
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          fontSize: "0.98rem",
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
                        color: "var(--text-subtle)",
                        fontSize: "0.72rem",
                        fontFamily: "var(--font-display)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
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
                        fontSize: "0.72rem",
                        fontFamily: "var(--font-display)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      Carry Over
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ maxWidth: 90, margin: "0 auto" }}>
                        <CarryOverInput
                          carryOverMinutes={currentWeek.carryOverMinutes}
                          updateWeek={updateWeek}
                        />
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        textAlign: "center",
                        color: "var(--text-subtle)",
                        fontSize: "0.72rem",
                        fontFamily: "var(--font-display)",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      Weekly Target
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div
                        style={{
                          maxWidth: 90,
                          margin: "0 auto",
                          display: "flex",
                          gap: 4,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <TargetInput
                          targetMinutes={currentWeek.targetMinutes}
                          updateWeek={updateWeek}
                        />
                        {currentWeek.carryOverMinutes > 0 && (
                          <span
                            style={{
                              fontSize: "0.68rem",
                              color: "var(--text-subtle)",
                              fontFamily: "var(--font-mono)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            +{minutesToTime(currentWeek.carryOverMinutes)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Progress bar */}
            <div
              style={{
                padding: "12px 18px",
                borderTop: "1px solid var(--border-soft)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.68rem",
                  color: "var(--text-subtle)",
                  marginBottom: 6,
                  fontFamily: "var(--font-display)",
                  letterSpacing: "0.04em",
                }}
              >
                <span style={{ textTransform: "uppercase", fontWeight: 600 }}>
                  Progress
                </span>
                <span style={{ fontFamily: "var(--font-mono)" }}>
                  {Math.round(progressPct)}%
                </span>
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

        {/* ══════════════════════════════════════════════
            SCHEDULE TABLE
        ══════════════════════════════════════════════ */}
        <section style={{ animation: "fadeInUp 0.4s ease 0.15s both" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <p className="section-title" style={{ margin: 0 }}>
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--sky)",
                  display: "inline-block",
                }}
              />
              Schedule
            </p>

            {/* TABS */}
            <div
              style={{
                display: "flex",
                background: "var(--surface-2)",
                padding: 3,
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border)",
                gap: 2,
              }}
            >
              <button
                onClick={() => setScheduleTab("lecture")}
                style={tabBtn(scheduleTab === "lecture")}
              >
                Lecture
              </button>
              <button
                onClick={() => setScheduleTab("working")}
                style={tabBtn(scheduleTab === "working")}
              >
                Working (Auto)
              </button>
            </div>
          </div>

          <p
            style={{
              fontSize: "0.74rem",
              color: "var(--text-subtle)",
              marginBottom: 10,
              fontStyle: "italic",
            }}
          >
            Lecture end + 1h buffer → work start · work end 00:00
          </p>

          {scheduleTab === "lecture" && (
            <div className="app-card">
              <div style={{ overflowX: "auto" }}>
                <table className="app-table">
                  <thead>
                    <tr>
                      <th
                        className="day-col"
                        rowSpan={2}
                        style={{ verticalAlign: "middle", width: 120 }}
                      >
                        Day
                      </th>
                      <th
                        colSpan={2}
                        style={{
                          background: "var(--success-soft)",
                          color: "var(--success)",
                        }}
                      >
                        Lecture
                      </th>
                      <th
                        colSpan={2}
                        style={{
                          background: "var(--primary-soft)",
                          color: "var(--primary)",
                        }}
                      >
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
                        (s) => s.day === day,
                      );
                      const autoCalc = getDailyAutoWork(sch);
                      return (
                        <React.Fragment key={day}>
                          {autoCalc.hasMorning && (
                            <tr>
                              <td className="day-col">
                                {DAY_SHORT[day]}{" "}
                                <span
                                  style={{
                                    fontSize: "0.62rem",
                                    color: "var(--text-subtle)",
                                    fontWeight: 400,
                                  }}
                                >
                                  (Morning)
                                </span>
                              </td>
                              <td>
                                <TimeInput
                                  value=""
                                  onChange={() => {}}
                                  disabled
                                />
                              </td>
                              <td>
                                <TimeInput
                                  value=""
                                  onChange={() => {}}
                                  disabled
                                />
                              </td>
                              <td>
                                <span
                                  className="auto-badge"
                                  style={{
                                    background: "var(--success-soft)",
                                    color: "var(--success)",
                                  }}
                                >
                                  {autoCalc.morningStart}
                                </span>
                              </td>
                              <td>
                                <span
                                  className="auto-badge"
                                  style={{
                                    background: "var(--success-soft)",
                                    color: "var(--success)",
                                  }}
                                >
                                  {autoCalc.morningEnd}
                                </span>
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td className="day-col">
                              {DAY_SHORT[day]}
                              {autoCalc.hasMorning && (
                                <span
                                  style={{
                                    fontSize: "0.62rem",
                                    color: "var(--text-subtle)",
                                    fontWeight: 400,
                                    marginLeft: 4,
                                  }}
                                >
                                  (Evening)
                                </span>
                              )}
                            </td>
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
                              {autoCalc.hasSchedule ? (
                                <span className="auto-badge">
                                  {autoCalc.eveningStart}
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-subtle)" }}>
                                  –
                                </span>
                              )}
                            </td>
                            <td>
                              {autoCalc.hasSchedule ? (
                                <span className="auto-badge">
                                  {autoCalc.eveningEnd}
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-subtle)" }}>
                                  –
                                </span>
                              )}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td
                        className="day-col"
                        style={{
                          fontWeight: 800,
                          color: "var(--text-subtle)",
                          textTransform: "uppercase",
                          fontSize: "0.7rem",
                          letterSpacing: "0.08em",
                        }}
                      >
                        Total
                      </td>
                      <td colSpan={2} />
                      <td colSpan={2} style={{ textAlign: "center" }}>
                        {(() => {
                          const totalMins = DAYS.reduce((sum, day) => {
                            const sch = currentWeek.schedules.find(
                              (s) => s.day === day,
                            );
                            return sum + getDailyAutoWork(sch).totalMins;
                          }, 0);
                          return totalMins > 0 ? (
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontWeight: 600,
                                fontSize: "0.88rem",
                                color: "var(--primary)",
                              }}
                            >
                              {minutesToTime(totalMins)}
                            </span>
                          ) : (
                            <span
                              style={{
                                color: "var(--text-subtle)",
                                fontSize: "0.8rem",
                              }}
                            >
                              —
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div
                style={{
                  padding: "10px 18px",
                  background: "var(--surface-2)",
                  fontSize: "0.76rem",
                  color: "var(--text-subtle)",
                  fontStyle: "italic",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <span>💡</span> Work start = lecture end + 1h · Work end = 00:00
              </div>
            </div>
          )}

          {scheduleTab === "working" && (
            <div className="app-card">
              <div style={{ overflowX: "auto" }}>
                <table className="app-table">
                  <thead>
                    <tr>
                      <th className="day-col" style={{ width: 120 }}>
                        Day
                      </th>
                      <th>Work Start</th>
                      <th>Work End</th>
                      <th
                        style={{
                          textAlign: "right",
                          paddingRight: 16,
                          color: "var(--primary)",
                        }}
                      >
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((day) => {
                      const sch = currentWeek.schedules.find(
                        (s) => s.day === day,
                      );
                      const autoCalc = getDailyAutoWork(sch);
                      return (
                        <React.Fragment key={day}>
                          {autoCalc.hasMorning && (
                            <tr>
                              <td className="day-col">
                                {DAY_SHORT[day]}{" "}
                                <span
                                  style={{
                                    fontSize: "0.62rem",
                                    color: "var(--text-subtle)",
                                    fontWeight: 400,
                                  }}
                                >
                                  (Morning)
                                </span>
                              </td>
                              <td>
                                <span
                                  className="auto-badge"
                                  style={{
                                    background: "var(--success-soft)",
                                    color: "var(--success)",
                                  }}
                                >
                                  {autoCalc.morningStart}
                                </span>
                              </td>
                              <td>
                                <span
                                  className="auto-badge"
                                  style={{
                                    background: "var(--success-soft)",
                                    color: "var(--success)",
                                  }}
                                >
                                  {autoCalc.morningEnd}
                                </span>
                              </td>
                              <td
                                style={{
                                  textAlign: "right",
                                  paddingRight: 16,
                                  fontFamily: "var(--font-mono)",
                                  fontWeight: 500,
                                  fontSize: "0.84rem",
                                }}
                              >
                                {minutesToTime(autoCalc.morningMins)}
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td className="day-col">
                              {DAY_SHORT[day]}
                              {autoCalc.hasMorning && (
                                <span
                                  style={{
                                    fontSize: "0.62rem",
                                    color: "var(--text-subtle)",
                                    fontWeight: 400,
                                    marginLeft: 4,
                                  }}
                                >
                                  (Evening)
                                </span>
                              )}
                            </td>
                            <td>
                              {autoCalc.hasSchedule ? (
                                <span className="auto-badge">
                                  {autoCalc.eveningStart}
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-subtle)" }}>
                                  –
                                </span>
                              )}
                            </td>
                            <td>
                              {autoCalc.hasSchedule ? (
                                <span className="auto-badge">
                                  {autoCalc.eveningEnd}
                                </span>
                              ) : (
                                <span style={{ color: "var(--text-subtle)" }}>
                                  –
                                </span>
                              )}
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                paddingRight: 16,
                                fontFamily: "var(--font-mono)",
                                fontWeight: 500,
                                fontSize: "0.84rem",
                              }}
                            >
                              {autoCalc.eveningMins > 0 ? (
                                minutesToTime(autoCalc.eveningMins)
                              ) : (
                                <span style={{ color: "var(--text-subtle)" }}>
                                  –
                                </span>
                              )}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                    {weekendSchedule.map(({ day, short, workMins }) => (
                      <tr
                        key={day}
                        style={{
                          background:
                            workMins > 0
                              ? "var(--primary-soft)"
                              : "transparent",
                        }}
                      >
                        <td
                          className="day-col"
                          style={{
                            color:
                              workMins > 0
                                ? "var(--primary)"
                                : "var(--text-subtle)",
                          }}
                        >
                          {short}
                        </td>
                        <td>
                          {workMins > 0 ? (
                            <span className="auto-badge">08:00</span>
                          ) : (
                            <span style={{ color: "var(--text-subtle)" }}>
                              –
                            </span>
                          )}
                        </td>
                        <td>
                          {workMins > 0 ? (
                            <span className="auto-badge">
                              {minutesToTime(8 * 60 + workMins)}
                            </span>
                          ) : (
                            <span
                              style={{
                                color: "var(--text-subtle)",
                                fontStyle: "italic",
                                fontSize: "0.74rem",
                              }}
                            >
                              Rest day
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            paddingRight: 16,
                            fontFamily: "var(--font-mono)",
                            fontWeight: workMins > 0 ? 600 : 400,
                            fontSize: "0.84rem",
                            color:
                              workMins > 0
                                ? "var(--primary)"
                                : "var(--text-subtle)",
                          }}
                        >
                          {workMins > 0 ? minutesToTime(workMins) : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          fontWeight: 800,
                          color: "var(--text-subtle)",
                          textTransform: "uppercase",
                          fontSize: "0.68rem",
                          letterSpacing: "0.08em",
                          fontFamily: "var(--font-display)",
                        }}
                      >
                        Total Weekly Auto-Schedule
                      </td>
                      <td style={{ textAlign: "right", paddingRight: 16 }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontWeight: 600,
                            fontSize: "0.9rem",
                            color: "var(--primary)",
                          }}
                        >
                          {minutesToTime(monFriWorkMins + satMins + sunMins)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div
                style={{
                  padding: "8px 18px",
                  borderTop: "1px solid var(--border-soft)",
                  fontSize: "0.7rem",
                  color: "var(--text-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  fontStyle: "italic",
                }}
              >
                <span>
                  💡 Mon–Fri: Auto-evening after lectures. Morning (08:00–11:30)
                  if lecture ≥ 12:00.
                </span>
                <span>
                  Sat/Sun: Max 8h/day to reach {formatDuration(targetMinutes)}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer
          style={{
            marginTop: 28,
            textAlign: "center",
            fontSize: "0.66rem",
            color: "var(--text-subtle)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.04em",
          }}
        >
          Auto-saved · {sortedKeys.length} week
          {sortedKeys.length !== 1 ? "s" : ""} stored
        </footer>
      </div>

      {/* ── Confirm Modal ─────────────────────────────── */}
      {confirmState.isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(4px)",
            animation: "fadeIn 0.15s ease-out forwards",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "24px",
              width: "90%",
              maxWidth: 360,
              boxShadow: "var(--shadow-lg)",
              animation: "slideUpFade 0.2s ease forwards",
            }}
          >
            <h3
              style={{
                fontSize: "0.95rem",
                fontWeight: 800,
                color: "var(--text)",
                marginBottom: 8,
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.01em",
              }}
            >
              {confirmState.title}
            </h3>
            <p
              style={{
                fontSize: "0.84rem",
                color: "var(--text-muted)",
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              {confirmState.message}
            </p>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                onClick={() =>
                  setConfirmState((prev) => ({ ...prev, isOpen: false }))
                }
                style={{
                  padding: "7px 14px",
                  borderRadius: "var(--radius)",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  fontFamily: "var(--font-display)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmState.onConfirm}
                style={{
                  padding: "7px 14px",
                  borderRadius: "var(--radius)",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  color: "#fff",
                  background: "var(--danger)",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-display)",
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report Modal ───────────────────────────────── */}
      {showReportModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setShowReportModal(false)}
        >
          <div
            style={{
              background: "#fff",
              color: "#111",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              maxWidth: 800,
              width: "100%",
              overflowX: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  fontFamily: "var(--font-display)",
                  letterSpacing: "-0.02em",
                  color: "#111",
                }}
              >
                Attendance Report
              </h2>
              <button
                onClick={() => setShowReportModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.4rem",
                  lineHeight: 1,
                  color: "#888",
                }}
              >
                &times;
              </button>
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "Arial, sans-serif",
                fontSize: 14,
                textAlign: "center",
              }}
            >
              <thead>
                <tr>
                  {[
                    "Hari",
                    "Login Pagi",
                    "Logout Pagi",
                    "Login Sore",
                    "Logout Sore",
                    "Total",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        border: "1px solid #000",
                        padding: "8px",
                        fontWeight: "normal",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_DAYS.map((day) => {
                  const idDay: Record<string, string> = {
                    Monday: "Senin",
                    Tuesday: "Selasa",
                    Wednesday: "Rabu",
                    Thursday: "Kamis",
                    Friday: "Jumat",
                    Saturday: "Sabtu",
                    Sunday: "Minggu",
                  };
                  const att = currentWeek.attendances.find(
                    (a) => a.day === day,
                  );
                  const totalMins = att
                    ? calcDuration(att.morningIn, att.morningOut) +
                      calcDuration(att.afternoonIn, att.afternoonOut)
                    : 0;
                  return (
                    <tr key={day}>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>
                        {idDay[day]}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>
                        {att?.morningIn.trim() || ""}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>
                        {att?.morningOut.trim() || ""}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>
                        {att?.afternoonIn.trim() || ""}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>
                        {att?.afternoonOut.trim() || ""}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "4px",
                          fontWeight: "bold",
                        }}
                      >
                        {totalMins > 0 ? minutesToTime(totalMins) : "0:00"}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                    }}
                  >
                    TOTAL
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      fontWeight: "bold",
                    }}
                  >
                    {minutesToTime(weeklyTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
