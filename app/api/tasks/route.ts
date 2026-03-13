import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const DONE_HIDE_WINDOW_MS = 24 * 60 * 60 * 1000;

// GET – all tasks for today (PENDING always shown; DONE hidden 24h after completion)
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");

    const cutoff = new Date(Date.now() - DONE_HIDE_WINDOW_MS);

    if (mode === "copy-work") {
      const tasks = await prisma.task.findMany({
        where: {
          userId: session.user.id,
          project: { label: { equals: "work", mode: "insensitive" } },
          OR: [
            { status: "PENDING" },
            { status: "DONE", completedAt: { gte: cutoff } },
          ],
        },
        orderBy: [
          { projectId: "asc" },
          { orderIndex: "asc" },
          { createdAt: "asc" },
        ],
        select: {
          id: true,
          title: true,
          status: true,
          completedAt: true,
          createdAt: true,
          projectId: true,
          orderIndex: true,
          project: { select: { name: true } },
        },
      });

      return NextResponse.json({
        tasks: tasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          completedAt: task.completedAt,
          createdAt: task.createdAt,
          projectId: task.projectId,
          orderIndex: task.orderIndex,
          projectName: task.project.name,
        })),
      });
    }

    const projectId = searchParams.get("projectId");
    if (!projectId)
      return NextResponse.json(
        { error: "projectId required" },
        { status: 400 },
      );

    const tasks = await prisma.task.findMany({
      where: {
        userId: session.user.id,
        projectId,
        // Show PENDING tasks always; DONE tasks only if completed < 24h ago.
        OR: [
          { status: "PENDING" },
          { status: "DONE", completedAt: { gte: cutoff } },
        ],
      },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        status: true,
        completedAt: true,
        createdAt: true,
        projectId: true,
        orderIndex: true,
      },
    });

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error("GET /api/tasks error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST – create a task
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { title, projectId, status = "PENDING" } = await req.json();
    if (!title?.trim())
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    if (!projectId)
      return NextResponse.json(
        { error: "projectId required" },
        { status: 400 },
      );

    if (status !== "PENDING" && status !== "DONE")
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });

    const { _max } = await prisma.task.aggregate({
      where: { userId: session.user.id, projectId },
      _max: { orderIndex: true },
    });

    const nextOrderIndex = (_max.orderIndex ?? -1) + 1;

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        projectId,
        userId: session.user.id,
        status,
        completedAt: status === "DONE" ? new Date() : null,
        orderIndex: nextOrderIndex,
      },
    });

    return NextResponse.json({ task });
  } catch (err) {
    console.error("POST /api/tasks error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH – reorder tasks, or update task status/title
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  try {
    const body = await req.json();
    const { id, status, title, projectId, orderedIds } = body;

    if (orderedIds !== undefined) {
      if (!Array.isArray(orderedIds))
        return NextResponse.json(
          { error: "orderedIds must be an array" },
          { status: 400 },
        );

      if (!projectId)
        return NextResponse.json(
          { error: "projectId required for reorder" },
          { status: 400 },
        );

      const cleanedOrderedIds = orderedIds.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      );

      if (cleanedOrderedIds.length !== orderedIds.length)
        return NextResponse.json(
          { error: "orderedIds must contain valid task ids" },
          { status: 400 },
        );

      const uniqueIds = new Set(cleanedOrderedIds);
      if (uniqueIds.size !== cleanedOrderedIds.length)
        return NextResponse.json(
          { error: "orderedIds contains duplicate ids" },
          { status: 400 },
        );

      const ownedTaskCount = await prisma.task.count({
        where: {
          userId,
          projectId,
          id: { in: cleanedOrderedIds },
        },
      });

      if (ownedTaskCount !== cleanedOrderedIds.length)
        return NextResponse.json(
          { error: "Some task ids are invalid" },
          { status: 400 },
        );

      await prisma.$transaction(
        cleanedOrderedIds.map((taskId, index) =>
          prisma.task.updateMany({
            where: { id: taskId, userId, projectId },
            data: { orderIndex: index },
          }),
        ),
      );

      const cutoff = new Date(Date.now() - DONE_HIDE_WINDOW_MS);
      const tasks = await prisma.task.findMany({
        where: {
          userId,
          projectId,
          OR: [
            { status: "PENDING" },
            { status: "DONE", completedAt: { gte: cutoff } },
          ],
        },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          status: true,
          completedAt: true,
          createdAt: true,
          projectId: true,
          orderIndex: true,
        },
      });

      return NextResponse.json({ tasks });
    }

    if (!id)
      return NextResponse.json({ error: "id required" }, { status: 400 });

    const data: {
      status?: "PENDING" | "DONE";
      title?: string;
      completedAt?: Date | null;
    } = {};

    if (typeof status === "string") {
      if (status !== "PENDING" && status !== "DONE")
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      data.status = status;
      data.completedAt = status === "DONE" ? new Date() : null;
    }

    if (typeof title === "string") {
      const trimmedTitle = title.trim();
      if (!trimmedTitle)
        return NextResponse.json({ error: "Title required" }, { status: 400 });
      data.title = trimmedTitle;
    }

    if (Object.keys(data).length === 0)
      return NextResponse.json(
        { error: "status or title required" },
        { status: 400 },
      );

    const updated = await prisma.task.updateMany({
      where: { id, userId },
      data,
    });

    if (updated.count === 0)
      return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const task = await prisma.task.findFirst({
      where: { id, userId },
      select: {
        id: true,
        title: true,
        status: true,
        completedAt: true,
        createdAt: true,
        projectId: true,
        orderIndex: true,
      },
    });

    return NextResponse.json({ task });
  } catch (err) {
    console.error("PATCH /api/tasks error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE – remove a task
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await req.json();
    await prisma.task.deleteMany({ where: { id, userId: session.user.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/tasks error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
