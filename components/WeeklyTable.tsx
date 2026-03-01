"use client";

import React, { useState } from "react";
import { DayRecord, DayName, DAYS } from "@/types";
import { minutesToTime, validateAndCalcSessions } from "@/lib/timeUtils";
import TimeInputRow from "./TimeInputRow";

interface WeeklyTableProps {
    records: DayRecord[];
    onUpdateRecord: (day: DayName, updated: Partial<DayRecord>) => void;
    onAddSession: (day: DayName) => void;
    onUpdateSession: (
        day: DayName,
        id: string,
        field: "loginTime" | "logoutTime",
        value: string
    ) => void;
    onRemoveSession: (day: DayName, id: string) => void;
}

export default function WeeklyTable({
    records,
    onUpdateRecord,
    onAddSession,
    onUpdateSession,
    onRemoveSession,
}: WeeklyTableProps) {
    const [expandedDay, setExpandedDay] = useState<DayName | null>(null);

    return (
        <div className="space-y-3">
            {DAYS.map((day) => {
                const record = records.find((r) => r.day === day);
                if (!record) return null;

                const { errors, totalMinutes } = validateAndCalcSessions(
                    record.workSessions
                );

                // Build per-session error map
                const sessionErrors: { [id: string]: string } = {};
                record.workSessions.forEach((s, idx) => {
                    const matchErr = errors.find((e) => e.startsWith(`Sesi ${idx + 1}:`));
                    if (matchErr) {
                        sessionErrors[s.id] = matchErr.replace(`Sesi ${idx + 1}: `, "");
                    }
                });

                const isExpanded = expandedDay === day;
                const hasData =
                    record.workSessions.length > 0 ||
                    record.lectureStart ||
                    record.lectureEnd;
                const isSpesialNoDesc =
                    record.scheduleType === "Spesial" && !record.description;

                return (
                    <div
                        key={day}
                        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${isExpanded
                                ? "border-indigo-500/40 bg-slate-800/70"
                                : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600/60"
                            }`}
                    >
                        {/* Row Header */}
                        <button
                            onClick={() => setExpandedDay(isExpanded ? null : day)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left group"
                        >
                            {/* Day */}
                            <div className="w-16 shrink-0">
                                <span
                                    className={`text-sm font-semibold ${isExpanded ? "text-indigo-300" : "text-slate-300"
                                        }`}
                                >
                                    {day}
                                </span>
                            </div>

                            {/* Lecture time */}
                            <div className="flex-1 min-w-0">
                                {record.lectureStart && record.lectureEnd ? (
                                    <span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">
                                        📚 {record.lectureStart} – {record.lectureEnd}
                                    </span>
                                ) : (
                                    <span className="text-xs text-slate-600 italic">
                                        Belum ada jadwal kuliah
                                    </span>
                                )}
                            </div>

                            {/* Schedule type badge */}
                            <div className="hidden sm:block shrink-0">
                                {record.scheduleType === "Spesial" ? (
                                    <span
                                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSpesialNoDesc
                                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                                : "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                            }`}
                                    >
                                        ★ Spesial
                                    </span>
                                ) : (
                                    <span className="text-xs px-2 py-0.5 rounded-full text-slate-500 bg-slate-700/40 border border-slate-700/40">
                                        Biasa
                                    </span>
                                )}
                            </div>

                            {/* Daily Total */}
                            <div className="shrink-0 text-right">
                                {totalMinutes > 0 ? (
                                    <span className="text-sm font-mono font-semibold text-indigo-400">
                                        {minutesToTime(totalMinutes)}
                                    </span>
                                ) : (
                                    <span className="text-xs text-slate-600">00:00</span>
                                )}
                            </div>

                            {/* Sessions count */}
                            {record.workSessions.length > 0 && (
                                <span className="text-xs text-slate-500 shrink-0">
                                    {record.workSessions.length} sesi
                                </span>
                            )}

                            {/* Expand icon */}
                            <span
                                className={`text-slate-500 transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-180 text-indigo-400" : ""
                                    }`}
                            >
                                ▾
                            </span>
                        </button>

                        {/* Expanded content */}
                        {isExpanded && (
                            <div className="px-4 pb-4 border-t border-slate-700/40 pt-3">
                                {/* Global errors */}
                                {errors.length > 0 && (
                                    <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                                        <p className="text-xs font-semibold text-red-400 mb-1">
                                            ⚠ Terdapat error pada sesi kerja:
                                        </p>
                                        <ul className="list-disc list-inside space-y-0.5">
                                            {errors.map((err, i) => (
                                                <li key={i} className="text-xs text-red-300">
                                                    {err}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <TimeInputRow
                                    dayRecord={record}
                                    onLectureChange={(field, value) =>
                                        onUpdateRecord(day, { [field]: value })
                                    }
                                    onScheduleTypeChange={(value) =>
                                        onUpdateRecord(day, { scheduleType: value })
                                    }
                                    onDescriptionChange={(value) =>
                                        onUpdateRecord(day, { description: value })
                                    }
                                    onAddSession={() => onAddSession(day)}
                                    onUpdateSession={(id, field, value) =>
                                        onUpdateSession(day, id, field, value)
                                    }
                                    onRemoveSession={(id) => onRemoveSession(day, id)}
                                    dailyTotal={totalMinutes}
                                    sessionErrors={sessionErrors}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
