"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type TaskStatus = "PENDING" | "DONE";
type ProjectLabel = "work" | "other";

interface Project {
  id: string;
  name: string;
  label: string;
  createdAt: string;
}
interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  projectId: string;
  completedAt: string | null;
  createdAt: string;
  orderIndex: number;
}
interface CopyTask {
  title: string;
  status: TaskStatus;
  projectId: string;
  projectName: string;
}

async function readJsonSafely<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function reorderTasksInSection(
  list: Task[],
  taskId: string,
  sectionStatus: TaskStatus,
  direction: "up" | "down",
): Task[] | null {
  const sectionTasks = list.filter((task) => task.status === sectionStatus);
  const fromSectionIndex = sectionTasks.findIndex((task) => task.id === taskId);
  if (fromSectionIndex < 0) return null;

  const toSectionIndex =
    direction === "up" ? fromSectionIndex - 1 : fromSectionIndex + 1;
  if (toSectionIndex < 0 || toSectionIndex >= sectionTasks.length) return null;

  const fromTaskId = sectionTasks[fromSectionIndex].id;
  const toTaskId = sectionTasks[toSectionIndex].id;
  const fromIndex = list.findIndex((task) => task.id === fromTaskId);
  const toIndex = list.findIndex((task) => task.id === toTaskId);
  if (fromIndex < 0 || toIndex < 0) return null;

  const next = [...list];
  [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
  return next;
}

// ── Spinner ───────────────────────────────────────────────────
function Spinner() {
  return (
    <div
      style={{
        width: 14,
        height: 14,
        border: "2px solid var(--border)",
        borderTopColor: "var(--primary)",
        borderRadius: "50%",
        display: "inline-block",
        animation: "spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

// ── Toast ─────────────────────────────────────────────────────
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-pill)",
        padding: "9px 20px",
        fontWeight: 600,
        fontFamily: "var(--font-display)",
        fontSize: "0.82rem",
        color: "var(--text)",
        boxShadow: "var(--shadow-md)",
        animation: "fadeInUp 0.25s ease",
        zIndex: 9999,
        letterSpacing: "0.01em",
      }}
    >
      {msg}
    </div>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────
function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(0,0,0,0.50)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        animation: "fadeInUp 0.2s ease",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "24px",
          maxWidth: 360,
          width: "100%",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div style={{ fontSize: "1.3rem", marginBottom: 8 }}>🗑️</div>
        <h2
          style={{
            margin: "0 0 8px",
            fontSize: "0.95rem",
            fontWeight: 800,
            color: "var(--text)",
            letterSpacing: "-0.01em",
            fontFamily: "var(--font-display)",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: "0.83rem",
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: "7px 14px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-muted)",
              fontWeight: 600,
              fontSize: "0.82rem",
              cursor: "pointer",
              fontFamily: "var(--font-display)",
            }}
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: "7px 14px",
              borderRadius: "var(--radius)",
              border: "none",
              background: "var(--danger)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.82rem",
              cursor: loading ? "default" : "pointer",
              fontFamily: "var(--font-display)",
              opacity: loading ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {loading ? <Spinner /> : "Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Theme Icon ────────────────────────────────────────────────
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

export default function TasksPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectLabel, setNewProjectLabel] = useState<ProjectLabel>("work");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [reorderingTaskId, setReorderingTaskId] = useState<string | null>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);

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
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("worktrack_theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [],
  );

  const loadProjects = useCallback(async () => {
    if (status !== "authenticated") return;

    try {
      const res = await fetch("/api/projects");
      const data = await readJsonSafely<{
        projects?: Project[];
        error?: string;
      }>(res);

      if (!res.ok) {
        setToast(`Error: ${data?.error ?? "Failed to load projects"}`);
        return;
      }

      const list = data?.projects ?? [];
      setProjects(list);
      if (list.length > 0 && !selectedProjectId) {
        setSelectedProjectId(list[0].id);
      }
    } catch {
      setToast("Network error. Please try again.");
    }
  }, [status, selectedProjectId]);

  useEffect(() => {
    loadProjects();
  }, [status]); // eslint-disable-line

  const loadTasks = useCallback(async (projectId: string) => {
    if (!projectId) return;
    setTasksLoading(true);

    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      const data = await readJsonSafely<{ tasks?: Task[]; error?: string }>(
        res,
      );

      if (!res.ok) {
        setToast(`Error: ${data?.error ?? "Failed to load tasks"}`);
        return;
      }

      setTasks(data?.tasks ?? []);
    } catch {
      setToast("Network error. Please try again.");
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) loadTasks(selectedProjectId);
    else setTasks([]);
  }, [selectedProjectId, loadTasks]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName.trim(),
          label: newProjectLabel,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.project) {
        setToast(`Error: ${data.error ?? "Failed"}`);
        return;
      }
      const { project } = data;
      setProjects((prev) => {
        const existingIndex = prev.findIndex((p) => p.id === project.id);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = project;
          return next;
        }
        return [...prev, project];
      });
      setSelectedProjectId(project.id);
      setNewProjectName("");
      setNewProjectLabel("work");
      setShowNewProject(false);
      setToast(`Project "${project.name}" ready`);
    } catch {
      setToast("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedProjectId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          projectId: selectedProjectId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.task) {
        setToast(`Error: ${data.error ?? "Failed"}`);
        return;
      }
      setTasks((prev) => [...prev, data.task]);
      setNewTaskTitle("");
      taskInputRef.current?.focus();
    } catch {
      setToast("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (task: Task) => {
    const next: TaskStatus = task.status === "DONE" ? "PENDING" : "DONE";
    const nextCompletedAt = next === "DONE" ? new Date().toISOString() : null;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: next, completedAt: nextCompletedAt }
          : t,
      ),
    );
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: next }),
      });
    } catch {
      setToast("Network error. Please try again.");
    } finally {
      loadTasks(selectedProjectId);
    }
  };

  const handleReorder = async (task: Task, direction: "up" | "down") => {
    if (!selectedProjectId || reorderingTaskId) return;

    const nextTasks = reorderTasksInSection(
      tasks,
      task.id,
      task.status,
      direction,
    );
    if (!nextTasks) return;

    const previousTasks = tasks;
    setTasks(nextTasks);
    setReorderingTaskId(task.id);

    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          orderedIds: nextTasks.map((t) => t.id),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed");
      }

      if (Array.isArray(data.tasks)) {
        setTasks(data.tasks);
      }
    } catch (err) {
      setTasks(previousTasks);
      setToast(
        `Error: ${err instanceof Error ? err.message : "Failed to reorder task"}`,
      );
    } finally {
      setReorderingTaskId((current) => (current === task.id ? null : current));
    }
  };

  const handleDelete = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch("/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const handleEditTask = async (task: Task, nextTitleRaw: string) => {
    const nextTitle = nextTitleRaw.trim();
    if (!nextTitle) {
      setToast("Judul task tidak boleh kosong.");
      return false;
    }
    if (nextTitle === task.title) return true;

    const prevTitle = task.title;
    setSavingTaskId(task.id);
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, title: nextTitle } : t)),
    );

    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, title: nextTitle }),
      });
      const data = await res.json();
      if (!res.ok || !data.task) {
        throw new Error(data.error ?? "Failed");
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, title: data.task.title } : t,
        ),
      );
      return true;
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, title: prevTitle } : t)),
      );
      setToast(
        `Error: ${err instanceof Error ? err.message : "Failed to update task"}`,
      );
      return false;
    } finally {
      setSavingTaskId((current) => (current === task.id ? null : current));
    }
  };

  const handleDeleteProject = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: confirmDelete.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setToast(`Error: ${data.error ?? "Failed"}`);
        return;
      }
      setProjects((prev) => prev.filter((p) => p.id !== confirmDelete.id));
      if (selectedProjectId === confirmDelete.id) {
        const remaining = projects.filter((p) => p.id !== confirmDelete.id);
        setSelectedProjectId(remaining[0]?.id ?? "");
      }
      setTasks([]);
      setToast(`Project "${confirmDelete.name}" dihapus`);
      setConfirmDelete(null);
    } catch {
      setToast("Network error.");
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks?mode=copy-work");
      const data = await res.json();

      if (!res.ok) {
        setToast(`Error: ${data.error ?? "Failed"}`);
        return;
      }

      const allWorkTasks = (data.tasks ?? []) as CopyTask[];
      if (allWorkTasks.length === 0) {
        setToast("Tidak ada task di project label work.");
        return;
      }

      const grouped = new Map<
        string,
        { done: CopyTask[]; pending: CopyTask[] }
      >();
      for (const task of allWorkTasks) {
        const bucket = grouped.get(task.projectName) ?? {
          done: [],
          pending: [],
        };
        if (task.status === "DONE") bucket.done.push(task);
        else bucket.pending.push(task);
        grouped.set(task.projectName, bucket);
      }

      const fmt = (list: CopyTask[], label: string) => {
        if (list.length === 0) return `--- ${label} ---\n(none)`;
        return `--- ${label} ---\n${list.map((t, i) => `${i + 1}. ${t.title}`).join("\n")}`;
      };

      const blocks = Array.from(grouped.entries()).map(
        ([projectName, bucket]) =>
          `# ${projectName}\n${fmt(bucket.done, "Done")}\n\n${fmt(bucket.pending, "Pending")}`,
      );

      const dateStr = new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const text = `${dateStr}\n\n${blocks.join("\n\n")}`;

      await navigator.clipboard.writeText(text);
      setCopied(true);
      setToast("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast("Failed to copy. Please allow clipboard access.");
    }
  }, []);

  const doneTasks = tasks.filter((t) => t.status === "DONE");
  const pendingTasks = tasks.filter((t) => t.status === "PENDING");
  const isReordering = reorderingTaskId !== null;
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const hasWorkProjects = projects.some(
    (p) => p.label?.toLowerCase() === "work",
  );

  if (status === "loading") {
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
        <Spinner />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div data-theme={theme} suppressHydrationWarning>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        .task-row { transition: background 0.1s; }
        .task-row:hover { background: var(--surface-2); }
        .task-row:hover .task-action { opacity: 1 !important; }
        .proj-tab {
          padding: 5px 13px; border-radius: var(--radius); border: 1px solid var(--border);
          background: var(--surface-2); color: var(--text-muted); font-size: 0.78rem;
          font-weight: 600; cursor: pointer; white-space: nowrap; font-family: var(--font-display);
          letter-spacing: 0.02em; transition: border-color 0.12s, color 0.12s, background 0.12s;
        }
        .proj-tab:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-soft); }
        .proj-tab.active { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
      `}</style>

      <div
        style={{ maxWidth: 700, margin: "0 auto", padding: "36px 20px 80px" }}
      >
        {/* ── Header ─────────────────────────────────── */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 28,
            gap: 12,
            flexWrap: "wrap",
            animation: "fadeInUp 0.35s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: "0.76rem",
                color: "var(--text-subtle)",
                textDecoration: "none",
                padding: "5px 11px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                letterSpacing: "0.02em",
                transition: "color 0.12s, border-color 0.12s",
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--primary)";
                (e.currentTarget as HTMLElement).style.borderColor =
                  "var(--primary)";
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.color =
                  "var(--text-subtle)";
                (e.currentTarget as HTMLElement).style.borderColor =
                  "var(--border)";
              }}
            >
              ← Attendance
            </Link>
            <div>
              <h1
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  margin: 0,
                  marginBottom: 1,
                  color: "var(--text)",
                  fontFamily: "var(--font-display)",
                  lineHeight: 1.2,
                }}
              >
                Daily Tasks
              </h1>
              <p
                style={{
                  fontSize: "0.74rem",
                  color: "var(--text-subtle)",
                  margin: 0,
                  fontWeight: 400,
                }}
              >
                Track what you built today
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {session?.user?.name && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  padding: "5px 10px",
                  background: "var(--surface-2)",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 500,
                }}
              >
                {session.user.name}
              </span>
            )}
            <button onClick={toggleTheme} className="btn-theme">
              <ThemeIcon theme={theme} />
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                fontSize: "0.75rem",
                color: "var(--danger)",
                background: "var(--danger-soft)",
                border: "1px solid rgba(191,32,32,0.2)",
                borderRadius: "var(--radius)",
                padding: "6px 12px",
                cursor: "pointer",
                fontWeight: 600,
                fontFamily: "var(--font-display)",
              }}
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* ── Project Tabs ──────────────────────────────── */}
        <section
          style={{
            marginBottom: 18,
            animation: "fadeInUp 0.35s ease 0.05s both",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              overflowX: "auto",
              flexWrap: "nowrap",
              paddingBottom: 4,
              scrollbarWidth: "none",
            }}
          >
            {projects.map((p) => (
              <div
                key={p.id}
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <button
                  className={`proj-tab${selectedProjectId === p.id ? " active" : ""}`}
                  onClick={() => setSelectedProjectId(p.id)}
                  style={{
                    paddingRight: selectedProjectId === p.id ? 28 : undefined,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{p.name}</span>
                  {p.label?.toLowerCase() === "work" && (
                    <span
                      style={{
                        fontSize: "0.62rem",
                        lineHeight: 1,
                        padding: "2px 6px",
                        borderRadius: "999px",
                        background: "var(--primary-soft)",
                        border: "1px solid var(--primary)",
                        color: "var(--primary)",
                        fontWeight: 700,
                      }}
                    >
                      work
                    </span>
                  )}
                </button>
                {selectedProjectId === p.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(p);
                    }}
                    title="Hapus project"
                    style={{
                      position: "absolute",
                      right: 7,
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--danger)",
                      fontSize: "0.65rem",
                      fontWeight: 900,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {!showNewProject ? (
              <button
                className="proj-tab"
                onClick={() => setShowNewProject(true)}
                style={{ borderStyle: "dashed", flexShrink: 0 }}
              >
                + New
              </button>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <input
                  autoFocus
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateProject();
                    if (e.key === "Escape") setShowNewProject(false);
                  }}
                  placeholder="Project name…"
                  style={{
                    padding: "5px 12px",
                    borderRadius: "var(--radius-pill)",
                    border: "1px solid var(--primary)",
                    background: "var(--primary-soft)",
                    color: "var(--text)",
                    outline: "none",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    width: 150,
                    fontFamily: "var(--font-display)",
                  }}
                />
                <select
                  value={newProjectLabel}
                  onChange={(e) =>
                    setNewProjectLabel(e.target.value as ProjectLabel)
                  }
                  style={{
                    padding: "5px 10px",
                    borderRadius: "var(--radius-pill)",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    outline: "none",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    fontFamily: "var(--font-display)",
                    textTransform: "lowercase",
                  }}
                >
                  <option value="work">work</option>
                  <option value="other">other</option>
                </select>
                <button
                  onClick={handleCreateProject}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "var(--radius-pill)",
                    border: "none",
                    background: "var(--primary)",
                    color: "#fff",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {loading ? <Spinner /> : "Add"}
                </button>
                <button
                  onClick={() => {
                    setShowNewProject(false);
                    setNewProjectName("");
                    setNewProjectLabel("work");
                  }}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "var(--radius-pill)",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text-subtle)",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Main Task Card ────────────────────────────── */}
        {selectedProjectId ? (
          <div
            className="app-card"
            style={{
              padding: 0,
              overflow: "hidden",
              animation: "fadeInUp 0.35s ease 0.1s both",
            }}
          >
            {/* Card header */}
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--primary)",
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {selectedProject?.name}
                </span>
                {selectedProject?.label && (
                  <span
                    style={{
                      fontSize: "0.62rem",
                      lineHeight: 1,
                      padding: "2px 6px",
                      borderRadius: "999px",
                      background:
                        selectedProject.label.toLowerCase() === "work"
                          ? "var(--primary-soft)"
                          : "var(--surface-3)",
                      border: `1px solid ${selectedProject.label.toLowerCase() === "work" ? "var(--primary)" : "var(--border)"}`,
                      color:
                        selectedProject.label.toLowerCase() === "work"
                          ? "var(--primary)"
                          : "var(--text-subtle)",
                      fontWeight: 700,
                    }}
                  >
                    {selectedProject.label.toLowerCase()}
                  </span>
                )}
                <span
                  style={{
                    fontSize: "0.68rem",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-pill)",
                    background: "var(--surface-3)",
                    color: "var(--text-subtle)",
                    fontWeight: 700,
                    border: "1px solid var(--border)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {tasks.length}
                </span>
              </div>

              {hasWorkProjects && (
                <button
                  onClick={handleCopy}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 11px",
                    borderRadius: "var(--radius)",
                    border: `1px solid ${copied ? "var(--success)" : "var(--border)"}`,
                    background: copied
                      ? "var(--success-soft)"
                      : "var(--surface-2)",
                    color: copied ? "var(--success)" : "var(--text-muted)",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {copied ? (
                    <>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>{" "}
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>{" "}
                      Copy
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Add task */}
            <form
              onSubmit={handleAddTask}
              style={{
                padding: "11px 18px",
                borderBottom: "1px solid var(--border-soft)",
                display: "flex",
                gap: 8,
              }}
            >
              <input
                ref={taskInputRef}
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add a new task…"
                style={{
                  flex: 1,
                  padding: "7px 11px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  outline: "none",
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-body)",
                  fontWeight: 400,
                  transition: "border-color 0.12s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
              <button
                type="submit"
                disabled={!newTaskTitle.trim() || loading}
                style={{
                  padding: "7px 15px",
                  borderRadius: "var(--radius)",
                  border: "none",
                  background: newTaskTitle.trim()
                    ? "var(--primary)"
                    : "var(--surface-3)",
                  color: newTaskTitle.trim() ? "#fff" : "var(--text-subtle)",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  cursor: newTaskTitle.trim() ? "pointer" : "default",
                  fontFamily: "var(--font-display)",
                  transition: "background 0.12s",
                }}
              >
                {loading ? <Spinner /> : "Add"}
              </button>
            </form>

            {/* Task list */}
            {tasksLoading ? (
              <div
                style={{
                  padding: 40,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Spinner />
              </div>
            ) : tasks.length === 0 ? (
              <div
                style={{
                  padding: "44px 20px",
                  textAlign: "center",
                  color: "var(--text-subtle)",
                  fontSize: "0.85rem",
                }}
              >
                <div
                  style={{ fontSize: "2.2rem", marginBottom: 10, opacity: 0.3 }}
                >
                  ✅
                </div>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-display)",
                    fontWeight: 500,
                  }}
                >
                  No tasks yet. Add one above!
                </p>
              </div>
            ) : (
              <div>
                {pendingTasks.length > 0 && (
                  <div>
                    <div
                      style={{
                        padding: "8px 18px 4px",
                        fontSize: "0.64rem",
                        fontWeight: 800,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--warning)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "var(--warning)",
                          display: "inline-block",
                        }}
                      />
                      Pending · {pendingTasks.length}
                    </div>
                    {pendingTasks.map((task, i) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        index={i}
                        onToggle={handleToggle}
                        onMoveUp={() => void handleReorder(task, "up")}
                        onMoveDown={() => void handleReorder(task, "down")}
                        canMoveUp={i > 0}
                        canMoveDown={i < pendingTasks.length - 1}
                        onEdit={handleEditTask}
                        onDelete={handleDelete}
                        saving={savingTaskId === task.id}
                        moving={reorderingTaskId === task.id}
                        reorderBusy={isReordering}
                      />
                    ))}
                  </div>
                )}
                {doneTasks.length > 0 && (
                  <div>
                    <div
                      style={{
                        padding: "8px 18px 4px",
                        fontSize: "0.64rem",
                        fontWeight: 800,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--success)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        borderTop:
                          pendingTasks.length > 0
                            ? "1px solid var(--border-soft)"
                            : undefined,
                        marginTop: pendingTasks.length > 0 ? 4 : 0,
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "var(--success)",
                          display: "inline-block",
                        }}
                      />
                      Done · {doneTasks.length}
                    </div>
                    {doneTasks.map((task, i) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        index={i}
                        onToggle={handleToggle}
                        onMoveUp={() => void handleReorder(task, "up")}
                        onMoveDown={() => void handleReorder(task, "down")}
                        canMoveUp={i > 0}
                        canMoveDown={i < doneTasks.length - 1}
                        onEdit={handleEditTask}
                        onDelete={handleDelete}
                        saving={savingTaskId === task.id}
                        moving={reorderingTaskId === task.id}
                        reorderBusy={isReordering}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {tasks.length > 0 && (
              <div
                style={{
                  padding: "9px 18px",
                  borderTop: "1px solid var(--border-soft)",
                  fontSize: "0.68rem",
                  color: "var(--text-subtle)",
                  textAlign: "center",
                  fontStyle: "italic",
                }}
              >
                Done tasks are hidden 24 hours after being marked done
              </div>
            )}
          </div>
        ) : (
          <div
            className="app-card"
            style={{
              padding: "56px 20px",
              textAlign: "center",
              color: "var(--text-subtle)",
              animation: "fadeInUp 0.35s ease",
            }}
          >
            <div
              style={{ fontSize: "2.8rem", marginBottom: 12, opacity: 0.25 }}
            >
              📁
            </div>
            <p
              style={{
                fontWeight: 700,
                marginBottom: 4,
                fontFamily: "var(--font-display)",
                fontSize: "0.9rem",
              }}
            >
              No project selected
            </p>
            <p style={{ fontSize: "0.78rem", margin: 0 }}>
              Create or select a project above to get started
            </p>
          </div>
        )}
      </div>

      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
      {confirmDelete && (
        <ConfirmModal
          title={`Hapus "${confirmDelete.name}"?`}
          message="Semua task di project ini juga akan dihapus. Tindakan ini tidak bisa dibatalkan."
          onConfirm={handleDeleteProject}
          onCancel={() => setConfirmDelete(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}

// ── Task Row ──────────────────────────────────────────────────
function TaskRow({
  task,
  index,
  onToggle,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onEdit,
  onDelete,
  saving,
  moving,
  reorderBusy,
}: {
  task: Task;
  index: number;
  onToggle: (t: Task) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: (task: Task, nextTitle: string) => Promise<boolean>;
  onDelete: (id: string) => void;
  saving: boolean;
  moving: boolean;
  reorderBusy: boolean;
}) {
  const isDone = task.status === "DONE";
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) editInputRef.current?.focus();
  }, [isEditing]);

  const startEdit = () => {
    setDraftTitle(task.title);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraftTitle(task.title);
    setIsEditing(false);
  };

  const saveEdit = async () => {
    const ok = await onEdit(task, draftTitle);
    if (ok) setIsEditing(false);
  };

  return (
    <div
      className="task-row"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 18px",
        borderBottom: "1px solid var(--border-soft)",
        animation: "fadeInUp 0.22s ease",
        opacity: isDone ? 0.65 : 1,
      }}
    >
      {/* Checkbox */}
      <div
        onClick={() => {
          if (!isEditing && !saving && !moving && !reorderBusy) onToggle(task);
        }}
        title={isDone ? "Mark as pending" : "Mark as done"}
        style={{
          width: 17,
          height: 17,
          borderRadius: 4,
          border: isDone ? "none" : "1.5px solid var(--border)",
          background: isDone ? "var(--success)" : "var(--surface-2)",
          cursor:
            isEditing || saving || moving || reorderBusy
              ? "default"
              : "pointer",
          flexShrink: 0,
          transition: "background 0.15s, border-color 0.15s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isDone && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {isEditing ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              color: "var(--text-subtle)",
              marginRight: 2,
              fontFamily: "var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {index + 1}.
          </span>
          <input
            ref={editInputRef}
            value={draftTitle}
            disabled={saving}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveEdit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelEdit();
              }
            }}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--primary)",
              background: "var(--surface-2)",
              color: "var(--text)",
              outline: "none",
              fontSize: "0.84rem",
              fontFamily: "var(--font-body)",
            }}
          />
          <button
            onClick={() => void saveEdit()}
            disabled={!draftTitle.trim() || saving}
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius)",
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              cursor: !draftTitle.trim() || saving ? "default" : "pointer",
              fontSize: "0.74rem",
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              display: "flex",
              alignItems: "center",
              gap: 5,
              minWidth: 56,
              justifyContent: "center",
              opacity: !draftTitle.trim() || saving ? 0.7 : 1,
            }}
          >
            {saving ? <Spinner /> : "Save"}
          </button>
          <button
            onClick={cancelEdit}
            disabled={saving}
            style={{
              padding: "6px 9px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-subtle)",
              cursor: saving ? "default" : "pointer",
              fontSize: "0.74rem",
              fontWeight: 600,
              fontFamily: "var(--font-display)",
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <span
          title="Double click to edit"
          onDoubleClick={startEdit}
          style={{
            flex: 1,
            fontSize: "0.875rem",
            fontWeight: 400,
            lineHeight: 1.4,
            color: "var(--text)",
            textDecoration: isDone ? "line-through" : "none",
            textDecorationColor: "var(--text-subtle)",
            fontFamily: "var(--font-body)",
          }}
        >
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              color: "var(--text-subtle)",
              marginRight: 6,
              fontFamily: "var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {index + 1}.
          </span>
          {task.title}
        </span>
      )}

      {!isEditing && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            className="task-action"
            onClick={onMoveUp}
            disabled={!canMoveUp || moving || reorderBusy || saving}
            title="Move up"
            style={{
              opacity: canMoveUp && !reorderBusy ? 0.8 : 0.28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: "var(--radius)",
              border: "none",
              background: "transparent",
              cursor:
                canMoveUp && !reorderBusy && !moving && !saving
                  ? "pointer"
                  : "default",
              color: "var(--text-subtle)",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseOver={(e) => {
              if (!canMoveUp || reorderBusy || moving || saving) return;
              e.currentTarget.style.background = "var(--surface-3)";
              e.currentTarget.style.color = "var(--text)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-subtle)";
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>

          <button
            className="task-action"
            onClick={onMoveDown}
            disabled={!canMoveDown || moving || reorderBusy || saving}
            title="Move down"
            style={{
              opacity: canMoveDown && !reorderBusy ? 0.8 : 0.28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: "var(--radius)",
              border: "none",
              background: "transparent",
              cursor:
                canMoveDown && !reorderBusy && !moving && !saving
                  ? "pointer"
                  : "default",
              color: "var(--text-subtle)",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseOver={(e) => {
              if (!canMoveDown || reorderBusy || moving || saving) return;
              e.currentTarget.style.background = "var(--surface-3)";
              e.currentTarget.style.color = "var(--text)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-subtle)";
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          <button
            className="task-action"
            onClick={startEdit}
            disabled={moving || reorderBusy || saving}
            title="Edit task"
            style={{
              opacity: moving || reorderBusy ? 0.35 : 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: "var(--radius)",
              border: "none",
              background: "transparent",
              cursor: moving || reorderBusy || saving ? "default" : "pointer",
              color: "var(--text-subtle)",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseOver={(e) => {
              if (moving || reorderBusy || saving) return;
              e.currentTarget.style.background = "var(--surface-3)";
              e.currentTarget.style.color = "var(--primary)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-subtle)";
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>

          <button
            className="task-action task-del"
            onClick={() => onDelete(task.id)}
            disabled={moving || reorderBusy || saving}
            title="Delete task"
            style={{
              opacity: moving || reorderBusy ? 0.35 : 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: "var(--radius)",
              border: "none",
              background: "transparent",
              cursor: moving || reorderBusy || saving ? "default" : "pointer",
              color: "var(--text-subtle)",
              transition: "background 0.12s, color 0.12s",
            }}
            onMouseOver={(e) => {
              if (moving || reorderBusy || saving) return;
              e.currentTarget.style.background = "var(--surface-3)";
              e.currentTarget.style.color = "var(--danger)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-subtle)";
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
