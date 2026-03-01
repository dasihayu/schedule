/**
 * Pure logic utility functions for Work Attendance
 * Format waktu: "HH:mm"
 */

// ─── TYPES ──────────────────────────────────────────────────────────────

export interface TimeSession {
    start: string; // "HH:mm"
    end: string;   // "HH:mm"
}

export interface DailyData {
    dayName: string;
    lectures: TimeSession[];
    workSessions: TimeSession[];
}

export interface WeeklyResult {
    totalMinutesPerWeek: number;
    totalFormattedPerWeek: string;
    isWeeklyTargetMet: boolean;
    dailyResults: DailyResult[];
}

export interface DailyResult {
    dayName: string;
    totalMinutesPerDay: number;
    totalFormattedPerDay: string;
    validationErrors: string[];
}

// ─── A. Menghitung durasi (Menit) ───────────────────────────────────────

/** 
 * Konversi "HH:mm" ke menit dari jam 00:00. 
 * Mengembalikan null jika format tidak valid.
 * Special case: "00:00" sebagai End time dihitung sebagai 1440 (24:00).
 */
export function timeToMinutes(time: string, isEndTime: boolean = false): number | null {
    if (!time) return null;
    const parts = time.split(":");
    if (parts.length !== 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;

    if (isEndTime && h === 0 && m === 0) {
        return 1440; // 24 jam penuh
    }
    return h * 60 + m;
}

/** 
 * Menghitung durasi dalam menit dari start hingga end. 
 */
export function getDurationMinutes(start: string, end: string): number {
    const s = timeToMinutes(start);
    const e = timeToMinutes(end, true);

    if (s === null || e === null) return 0;
    if (e <= s) return 0; // Error / durasi 0

    return e - s;
}

// ─── D. Mengubah format ke HH:mm ────────────────────────────────────────

/**
 * Konversi menit kembali ke format "HH:mm"
 */
export function minutesToHHmm(minutes: number): string {
    if (minutes < 0) return "00:00";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── E. Validasi Harian ──────────────────────────────────────────────────

/**
 * Validasi konflik dan format waktu dalam 1 hari.
 * Mengembalikan array of string berisi pesan error.
 */
export function validateDailySessions(data: DailyData): string[] {
    const errors: string[] = [];
    const allSessions: Array<{ type: "work" | "lecture"; start: number; end: number; rawStart: string; rawEnd: string }> = [];

    // Parse kerja
    for (const w of data.workSessions) {
        const s = timeToMinutes(w.start);
        const e = timeToMinutes(w.end, true);

        if (s === null || e === null) {
            errors.push(`Format waktu kerja tidak valid (${w.start} - ${w.end}) pada hari ${data.dayName}`);
            continue;
        }

        // - Tidak boleh logout < login (atau sama dengan)
        if (e <= s) {
            errors.push(`Jam keluar (${w.end}) harus lebih besar dari jam masuk (${w.start}) pada hari ${data.dayName}`);
            continue;
        }

        // - Tidak boleh kerja lewat 00:00 (otomatis tercover karena parsing isEndTime membatasi 1440 maks)
        if (e > 1440) {
            errors.push(`Kerja tidak boleh melewati jam 00:00 pada hari ${data.dayName}`);
        }

        allSessions.push({ type: "work", start: s, end: e, rawStart: w.start, rawEnd: w.end });
    }

    // Parse kuliah
    for (const l of data.lectures) {
        const s = timeToMinutes(l.start);
        const e = timeToMinutes(l.end, true);
        if (s !== null && e !== null && e > s) {
            allSessions.push({ type: "lecture", start: s, end: e, rawStart: l.start, rawEnd: l.end });
        }
    }

    // Validasi Bentrok (Overlap)
    // Syarat overlap: start A < end B && end A > start B
    for (let i = 0; i < allSessions.length; i++) {
        for (let j = i + 1; j < allSessions.length; j++) {
            const a = allSessions[i];
            const b = allSessions[j];

            if (a.start < b.end && a.end > b.start) {
                if (a.type === "work" && b.type === "work") {
                    errors.push(`Sesi kerja bentrok antara (${a.rawStart}-${a.rawEnd}) dan (${b.rawStart}-${b.rawEnd}) pada hari ${data.dayName}`);
                } else if (a.type === "lecture" && b.type === "lecture") {
                    errors.push(`Sesi kuliah bentrok antara (${a.rawStart}-${a.rawEnd}) dan (${b.rawStart}-${b.rawEnd}) pada hari ${data.dayName}`);
                } else {
                    errors.push(`Jam kerja (${a.type === 'work' ? a.rawStart + '-' + a.rawEnd : b.rawStart + '-' + b.rawEnd}) bentrok dengan jadwal kuliah (${a.type === 'lecture' ? a.rawStart + '-' + a.rawEnd : b.rawStart + '-' + b.rawEnd}) pada hari ${data.dayName}`);
                }
            }
        }
    }

    return errors;
}

// ─── B. Menghitung total harian ──────────────────────────────────────────

/**
 * Menghitung dan memvalidasi satu hari kerja.
 */
export function calculateDailyWork(data: DailyData): DailyResult {
    const validationErrors = validateDailySessions(data);
    let totalMinutesPerDay = 0;

    // Hanya hitung jika tidak ada error pada hari tersebut untuk sesi kerjanya
    // Jika preferensi mengharuskan dihitung meski error, hapus kondisi checking if(validationErrors.length === 0)
    for (const w of data.workSessions) {
        totalMinutesPerDay += getDurationMinutes(w.start, w.end);
    }

    return {
        dayName: data.dayName,
        totalMinutesPerDay,
        totalFormattedPerDay: minutesToHHmm(totalMinutesPerDay),
        validationErrors
    };
}

// ─── C & F. Menghitung total mingguan & Status ───────────────────────────

/**
 * Menghitung total mingguan, termasuk pengecekan target mingguan
 * Target default = 40 jam (2400 menit)
 */
export function calculateWeeklyWork(weeklyData: DailyData[], targetMinutes: number = 2400): WeeklyResult {
    let totalMinutesPerWeek = 0;
    const dailyResults: DailyResult[] = [];

    for (const daily of weeklyData) {
        const dailyResult = calculateDailyWork(daily);
        dailyResults.push(dailyResult);

        // Asumsi: jika error, tetap akumulasi atau tidak? (Disini tetap diakumulasi)
        totalMinutesPerWeek += dailyResult.totalMinutesPerDay;
    }

    const isWeeklyTargetMet = totalMinutesPerWeek >= targetMinutes;

    return {
        totalMinutesPerWeek,
        totalFormattedPerWeek: minutesToHHmm(totalMinutesPerWeek),
        isWeeklyTargetMet,
        dailyResults
    };
}
