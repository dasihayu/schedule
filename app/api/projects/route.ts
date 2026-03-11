import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const normalizeLabel = (value: unknown): string => {
    if (typeof value !== "string") return "work";
    const normalized = value.trim().toLowerCase();
    return normalized || "work";
};

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const projects = await prisma.project.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, label: true, createdAt: true },
    });

    return NextResponse.json({ projects });
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { name, label } = body;
        if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

        const normalizedLabel = normalizeLabel(label);

        // upsert: if project with same name already exists, return it
        const project = await prisma.project.upsert({
            where: { userId_name: { userId: session.user.id, name: name.trim() } },
            update: { label: normalizedLabel },
            create: { name: name.trim(), label: normalizedLabel, userId: session.user.id },
        });

        return NextResponse.json({ project });
    } catch (err) {
        console.error("POST /api/projects error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { id } = await req.json();
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

        await prisma.project.deleteMany({
            where: { id, userId: session.user.id },
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("DELETE /api/projects error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
