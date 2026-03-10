import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/weeks — fetch all weeks for the logged-in user
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const records = await prisma.weekRecord.findMany({
        where: { userId: session.user.id },
        orderBy: { weekKey: "asc" },
    });

    return NextResponse.json({ weeks: records });
}

// POST /api/weeks — upsert a week record
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { weekKey, carryOverMinutes = 0, targetMinutes = 2400, schedules = [], attendances = [] } =
            await req.json();

        if (!weekKey) {
            return NextResponse.json({ error: "weekKey is required" }, { status: 400 });
        }

        const week = await prisma.weekRecord.upsert({
            where: {
                userId_weekKey: { userId: session.user.id, weekKey },
            },
            create: {
                weekKey,
                carryOverMinutes,
                targetMinutes,
                schedules,
                attendances,
                userId: session.user.id,
            },
            update: {
                carryOverMinutes,
                targetMinutes,
                schedules,
                attendances,
            },
        });

        return NextResponse.json({ week });
    } catch (err) {
        console.error("Weeks API error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
