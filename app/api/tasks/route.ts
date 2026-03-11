import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET – all tasks for today (PENDING always shown; DONE hidden after 24h)
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    if (mode === "copy-work") {
        const tasks = await prisma.task.findMany({
            where: {
                userId: session.user.id,
                project: { label: { equals: "work", mode: "insensitive" } },
                OR: [
                    { status: "PENDING" },
                    { status: "DONE", createdAt: { gte: cutoff } },
                ],
            },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                title: true,
                status: true,
                createdAt: true,
                projectId: true,
                project: { select: { name: true } },
            },
        });

        return NextResponse.json({
            tasks: tasks.map((task) => ({
                id: task.id,
                title: task.title,
                status: task.status,
                createdAt: task.createdAt,
                projectId: task.projectId,
                projectName: task.project.name,
            })),
        });
    }

    const projectId = searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const tasks = await prisma.task.findMany({
        where: {
            userId: session.user.id,
            projectId,
            // Show PENDING tasks always; DONE tasks only if < 24h old
            OR: [
                { status: "PENDING" },
                { status: "DONE", createdAt: { gte: cutoff } },
            ],
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, status: true, createdAt: true, projectId: true },
    });

    return NextResponse.json({ tasks });
}

// POST – create a task
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { title, projectId, status = "PENDING" } = await req.json();
        if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
        if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

        const task = await prisma.task.create({
            data: {
                title: title.trim(),
                projectId,
                userId: session.user.id,
                status,
            },
        });

        return NextResponse.json({ task });
    } catch (err) {
        console.error("POST /api/tasks error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// PATCH – toggle status
export async function PATCH(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { id, status } = await req.json();
        if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

        const task = await prisma.task.updateMany({
            where: { id, userId: session.user.id },
            data: { status },
        });

        return NextResponse.json({ task });
    } catch (err) {
        console.error("PATCH /api/tasks error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// DELETE – remove a task
export async function DELETE(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { id } = await req.json();
        await prisma.task.deleteMany({ where: { id, userId: session.user.id } });
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("DELETE /api/tasks error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
