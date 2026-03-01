"use client";

import React from "react";
import { minutesToTime } from "@/lib/timeUtils";

interface SummaryProps {
    totalWeeklyMinutes: number;
    targetMinutes?: number;
}

export default function Summary({
    totalWeeklyMinutes,
    targetMinutes = 40 * 60,
}: SummaryProps) {
    const diff = totalWeeklyMinutes - targetMinutes;
    const totalTime = minutesToTime(totalWeeklyMinutes);
    const targetTime = minutesToTime(targetMinutes);

    let statusLabel = "";
    let statusClass = "";
    let statusIcon = "";
    let progressPercent = Math.min(100, (totalWeeklyMinutes / targetMinutes) * 100);

    if (totalWeeklyMinutes === 0) {
        statusLabel = "Belum ada data";
        statusClass = "text-slate-400";
        statusIcon = "⏳";
    } else if (totalWeeklyMinutes < targetMinutes) {
        const kurang = minutesToTime(Math.abs(diff));
        statusLabel = `Kurang ${kurang}`;
        statusClass = "text-amber-400";
        statusIcon = "⚠";
    } else if (totalWeeklyMinutes === targetMinutes) {
        statusLabel = "Tepat 40 Jam ✓";
        statusClass = "text-emerald-400";
        statusIcon = "✅";
    } else {
        const lebih = minutesToTime(diff);
        statusLabel = `Lebih ${lebih}`;
        statusClass = "text-sky-400";
        statusIcon = "🎉";
    }

    return (
        <div className="mt-6 rounded-2xl bg-slate-800/60 border border-slate-700/60 p-5 backdrop-blur">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Ringkasan Mingguan
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                {/* Total */}
                <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/40">
                    <p className="text-xs text-slate-500 mb-1">Total Kerja</p>
                    <p className="text-2xl font-bold text-slate-100 font-mono">{totalTime}</p>
                    <p className="text-xs text-slate-500">jam</p>
                </div>

                {/* Target */}
                <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/40">
                    <p className="text-xs text-slate-500 mb-1">Target</p>
                    <p className="text-2xl font-bold text-slate-300 font-mono">{targetTime}</p>
                    <p className="text-xs text-slate-500">jam / minggu</p>
                </div>

                {/* Status */}
                <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/40">
                    <p className="text-xs text-slate-500 mb-1">Status</p>
                    <p className={`text-lg font-bold ${statusClass}`}>
                        {statusIcon} {statusLabel}
                    </p>
                </div>
            </div>

            {/* Progress Bar */}
            <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Progress pencapaian</span>
                    <span>{progressPercent.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${totalWeeklyMinutes === 0
                                ? "bg-slate-600"
                                : totalWeeklyMinutes < targetMinutes
                                    ? "bg-amber-500"
                                    : totalWeeklyMinutes === targetMinutes
                                        ? "bg-emerald-500"
                                        : "bg-sky-500"
                            }`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* Warning */}
            {totalWeeklyMinutes > 0 && totalWeeklyMinutes < targetMinutes && (
                <div className="mt-4 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    <span className="text-amber-400 text-base shrink-0">⚠</span>
                    <p className="text-amber-300 text-sm">
                        Total jam kerja minggu ini belum mencapai 40 jam. Masih kurang{" "}
                        <strong>{minutesToTime(Math.abs(diff))}</strong> lagi.
                    </p>
                </div>
            )}
        </div>
    );
}
