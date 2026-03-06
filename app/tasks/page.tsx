"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

type TaskStatus = "PENDING" | "DONE";

interface Project {
    id: string;
    name: string;
    createdAt: string;
}

interface Task {
    id: string;
    title: string;
    status: TaskStatus;
    projectId: string;
    createdAt: string;
}

// ── Tiny spinner ──────────────────────────────────────────────
function Spinner() {
    return (
        <div style={{
            width: 16, height: 16,
            border: "2px solid var(--border)",
            borderTopColor: "var(--primary)",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.7s linear infinite",
            flexShrink: 0,
        }} />
    );
}

// ── Toast ─────────────────────────────────────────────────────
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
    useEffect(() => {
        const t = setTimeout(onDone, 2200);
        return () => clearTimeout(t);
    }, [onDone]);
    return (
        <div style={{
            position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
            background: "var(--surface)", border: "1px solid var(--border)",
            backdropFilter: "blur(16px)", borderRadius: 14,
            padding: "10px 22px", fontWeight: 600, fontSize: "0.88rem",
            color: "var(--text)", boxShadow: "var(--shadow-md)",
            animation: "fadeInUp 0.3s ease", zIndex: 9999,
        }}>
            {msg}
        </div>
    );
}

// ── Confirm Modal ─────────────────────────────────────────
function ConfirmModal({
    title, message, onConfirm, onCancel, loading,
}: {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}) {
    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20, animation: "fadeInUp 0.2s ease",
        }}>
            <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 20, padding: "28px 28px 24px",
                maxWidth: 380, width: "100%",
                boxShadow: "var(--shadow-md)",
            }}>
                <div style={{ fontSize: "1.4rem", marginBottom: 8 }}>🗑️</div>
                <h2 style={{
                    margin: "0 0 8px", fontSize: "1rem", fontWeight: 800,
                    color: "var(--text)", letterSpacing: "-0.02em",
                }}>{title}</h2>
                <p style={{
                    margin: "0 0 24px", fontSize: "0.85rem",
                    color: "var(--text-muted)", lineHeight: 1.5,
                }}>{message}</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        style={{
                            padding: "8px 18px", borderRadius: 10,
                            border: "1px solid var(--border)", background: "transparent",
                            color: "var(--text-muted)", fontWeight: 600,
                            fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit",
                        }}
                    >Batal</button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        style={{
                            padding: "8px 18px", borderRadius: 10, border: "none",
                            background: "var(--danger)", color: "#fff",
                            fontWeight: 700, fontSize: "0.85rem",
                            cursor: loading ? "default" : "pointer",
                            fontFamily: "inherit", opacity: loading ? 0.7 : 1,
                            display: "flex", alignItems: "center", gap: 6,
                        }}
                    >
                        {loading ? <Spinner /> : "Hapus"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Sun/Moon ──────────────────────────────────────────────────
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

export default function TasksPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [theme, setTheme] = useState<"dark" | "light">("dark");
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>("");
    const [tasks, setTasks] = useState<Task[]>([]);
    const [newProjectName, setNewProjectName] = useState("");
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [loading, setLoading] = useState(false);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [showNewProject, setShowNewProject] = useState(false);
    const [toast, setToast] = useState("");
    const [copied, setCopied] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
    const [deleting, setDeleting] = useState(false);
    const taskInputRef = useRef<HTMLInputElement>(null);

    // ── Auth redirect ──────────────────────────────────────────
    useEffect(() => {
        if (status === "unauthenticated") router.push("/login");
    }, [status, router]);

    // ── Theme ──────────────────────────────────────────────────
    useEffect(() => {
        const t = localStorage.getItem("worktrack_theme") as "dark" | "light" | null;
        if (t) setTheme(t);
        else if (window.matchMedia("(prefers-color-scheme: light)").matches) setTheme("light");
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("worktrack_theme", theme);
    }, [theme]);

    const toggleTheme = useCallback(() => setTheme(t => t === "dark" ? "light" : "dark"), []);

    // ── Load projects ──────────────────────────────────────────
    const loadProjects = useCallback(async () => {
        if (status !== "authenticated") return;
        const res = await fetch("/api/projects");
        const { projects: list } = await res.json();
        setProjects(list ?? []);
        if (list?.length > 0 && !selectedProjectId) {
            setSelectedProjectId(list[0].id);
        }
    }, [status, selectedProjectId]);

    useEffect(() => { loadProjects(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Load tasks ─────────────────────────────────────────────
    const loadTasks = useCallback(async (projectId: string) => {
        if (!projectId) return;
        setTasksLoading(true);
        try {
            const res = await fetch(`/api/tasks?projectId=${projectId}`);
            const { tasks: list } = await res.json();
            setTasks(list ?? []);
        } finally {
            setTasksLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedProjectId) loadTasks(selectedProjectId);
        else setTasks([]);
    }, [selectedProjectId, loadTasks]);

    // ── Create project ─────────────────────────────────────────
    const handleCreateProject = async () => {
        if (!newProjectName.trim()) return;
        setLoading(true);
        try {
            const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newProjectName.trim() }),
            });
            const data = await res.json();
            if (!res.ok || !data.project) {
                setToast(`Error: ${data.error ?? "Failed to create project"}`);
                return;
            }
            const { project } = data;
            setProjects(prev => {
                const exists = prev.find(p => p.id === project.id);
                return exists ? prev : [...prev, project];
            });
            setSelectedProjectId(project.id);
            setNewProjectName("");
            setShowNewProject(false);
            setToast(`Project "${project.name}" ready`);
        } catch {
            setToast("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ── Create task ────────────────────────────────────────────
    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim() || !selectedProjectId) return;
        setLoading(true);
        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newTaskTitle.trim(), projectId: selectedProjectId }),
            });
            const data = await res.json();
            if (!res.ok || !data.task) {
                setToast(`Error: ${data.error ?? "Failed to add task"}`);
                return;
            }
            setTasks(prev => [...prev, data.task]);
            setNewTaskTitle("");
            taskInputRef.current?.focus();
        } catch {
            setToast("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ── Toggle status ──────────────────────────────────────────
    const handleToggle = async (task: Task) => {
        const next: TaskStatus = task.status === "DONE" ? "PENDING" : "DONE";
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t));
        await fetch("/api/tasks", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: task.id, status: next }),
        });
        // Re-fetch to apply 24h hide logic from server
        loadTasks(selectedProjectId);
    };

    // ── Delete task ────────────────────────────────────────────
    const handleDelete = async (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
        await fetch("/api/tasks", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });
    };

    // ── Delete project ──────────────────────────────────────────
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
                setToast(`Error: ${data.error ?? "Failed to delete"}`);
                return;
            }
            setProjects(prev => prev.filter(p => p.id !== confirmDelete.id));
            if (selectedProjectId === confirmDelete.id) {
                const remaining = projects.filter(p => p.id !== confirmDelete.id);
                setSelectedProjectId(remaining[0]?.id ?? "");
            }
            setTasks([]);
            setToast(`Project "${confirmDelete.name}" dihapus`);
            setConfirmDelete(null);
        } catch {
            setToast("Network error. Coba lagi.");
        } finally {
            setDeleting(false);
        }
    };

    // ── Copy to clipboard ──────────────────────────────────────
    const handleCopy = useCallback(async () => {
        const done = tasks.filter(t => t.status === "DONE");
        const pending = tasks.filter(t => t.status === "PENDING");

        const fmt = (list: Task[], label: string) => {
            if (list.length === 0) return `--- ${label} ---\n(none)`;
            return `--- ${label} ---\n` + list.map((t, i) => `${i + 1}. ${t.title}`).join("\n");
        };

        const dateStr = new Date().toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        });

        const text = `${dateStr}\n\n${fmt(done, "Done")}\n\n${fmt(pending, "Pending")}`;

        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setToast("Copied to clipboard!");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setToast("Failed to copy. Please allow clipboard access.");
        }
    }, [tasks]);

    // ── Derived ────────────────────────────────────────────────
    const doneTasks = tasks.filter(t => t.status === "DONE");
    const pendingTasks = tasks.filter(t => t.status === "PENDING");
    const selectedProject = projects.find(p => p.id === selectedProjectId);

    if (status === "loading") {
        return (
            <div data-theme={theme} style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-gradient)" }}>
                <Spinner />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        );
    }

    return (
        <div data-theme={theme} suppressHydrationWarning>
            <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeInUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
        @keyframes checkPop { 0% { transform: scale(0.8) } 60% { transform: scale(1.15) } 100% { transform: scale(1) } }
        .task-row { transition: background 0.2s, opacity 0.2s; }
        .task-row:hover { background: var(--surface-2); }
        .task-row:hover .task-del { opacity: 1; }
        .task-del { opacity: 0; transition: opacity 0.2s; }
        .project-tab { 
          padding: 6px 14px; border-radius: 99px; border: 1px solid var(--border);
          background: var(--surface-2); color: var(--text-muted); font-size: 0.82rem;
          font-weight: 600; cursor: pointer; transition: all 0.18s;
          white-space: nowrap;
        }
        .project-tab:hover { border-color: var(--primary); color: var(--primary); }
        .project-tab.active { background: var(--primary-soft); border-color: var(--primary); color: var(--primary); }
        .btn-icon { 
          display:flex; align-items:center; justify-content:center; 
          width:30px; height:30px; border-radius:8px; border:none; 
          background:transparent; cursor:pointer; transition:all 0.18s;
          color: var(--text-subtle);
        }
        .btn-icon:hover { background: var(--surface-3); color: var(--danger); }
        .check-box {
          width: 20px; height: 20px; border-radius: 6px; border: 2px solid var(--border);
          background: var(--surface-3); cursor: pointer; flex-shrink: 0;
          transition: all 0.2s; display:flex; align-items:center; justify-content:center;
        }
        .check-box.done { background: var(--success); border-color: var(--success); animation: checkPop 0.25s ease; }
      `}</style>

            <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>

                {/* ── Header ─────────────────────────────────────────── */}
                <header style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 32, gap: 12, flexWrap: "wrap",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        {/* Back to attendance */}
                        <a href="/" style={{
                            display: "flex", alignItems: "center", gap: 6,
                            fontSize: "0.8rem", color: "var(--text-subtle)", textDecoration: "none",
                            padding: "6px 12px", borderRadius: 10,
                            border: "1px solid var(--border)", background: "var(--surface-2)",
                            transition: "all 0.18s", fontWeight: 600,
                        }}
                            onMouseOver={e => { (e.currentTarget as HTMLElement).style.color = "var(--primary)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)"; }}
                            onMouseOut={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-subtle)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                        >
                            ← Attendance
                        </a>
                        <div>
                            <h1 style={{
                                fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", margin: 0,
                                background: "linear-gradient(135deg, var(--primary), var(--sky))",
                                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                            }}>
                                Daily Tasks
                            </h1>
                            <p style={{ fontSize: "0.78rem", color: "var(--text-subtle)", margin: "2px 0 0", fontWeight: 500 }}>
                                Track what you built today
                            </p>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {session?.user?.name && (
                            <span style={{
                                fontSize: "0.78rem", color: "var(--text-muted)",
                                padding: "5px 10px", background: "var(--surface-2)",
                                borderRadius: 8, border: "1px solid var(--border)",
                            }}>
                                👤 {session.user.name}
                            </span>
                        )}
                        <button onClick={toggleTheme} className="btn-theme">
                            <ThemeIcon theme={theme} />
                            {theme === "dark" ? "Light" : "Dark"}
                        </button>
                        <button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            style={{
                                fontSize: "0.75rem", color: "var(--danger)",
                                background: "var(--danger-soft)",
                                border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
                                borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 600,
                            }}
                        >
                            Sign Out
                        </button>
                    </div>
                </header>

                {/* ── Project Tabs ───────────────────────────────────── */}
                <section style={{ marginBottom: 20 }}>
                    <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        overflowX: "auto", flexWrap: "nowrap",
                        paddingBottom: 4,
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                    }}>
                        {projects.map(p => (
                            <div key={p.id} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                                <button
                                    className={`project-tab${selectedProjectId === p.id ? " active" : ""}`}
                                    onClick={() => setSelectedProjectId(p.id)}
                                    style={{ paddingRight: selectedProjectId === p.id ? 28 : undefined }}
                                >
                                    {p.name}
                                </button>
                                {selectedProjectId === p.id && (
                                    <button
                                        onClick={e => { e.stopPropagation(); setConfirmDelete(p); }}
                                        title="Hapus project"
                                        style={{
                                            position: "absolute", right: 6,
                                            width: 16, height: 16, borderRadius: "50%",
                                            border: "none", background: "transparent",
                                            cursor: "pointer", display: "flex",
                                            alignItems: "center", justifyContent: "center",
                                            color: "var(--danger)", fontSize: "0.7rem",
                                            fontWeight: 900, padding: 0, lineHeight: 1,
                                        }}
                                    >✕</button>
                                )}
                            </div>
                        ))}

                        {/* New project button / form */}
                        {!showNewProject ? (
                            <button
                                className="project-tab"
                                onClick={() => setShowNewProject(true)}
                                style={{ borderStyle: "dashed" }}
                            >
                                + New Project
                            </button>
                        ) : (
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <input
                                    autoFocus
                                    value={newProjectName}
                                    onChange={e => setNewProjectName(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") handleCreateProject(); if (e.key === "Escape") setShowNewProject(false); }}
                                    placeholder="Project name…"
                                    style={{
                                        padding: "6px 12px", borderRadius: 99, border: "1px solid var(--primary)",
                                        background: "var(--primary-soft)", color: "var(--text)", outline: "none",
                                        fontSize: "0.82rem", fontWeight: 600, width: 160,
                                        fontFamily: "inherit",
                                    }}
                                />
                                <button
                                    onClick={handleCreateProject}
                                    style={{
                                        padding: "6px 12px", borderRadius: 99, border: "none",
                                        background: "var(--primary)", color: "#fff",
                                        fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
                                    }}
                                >
                                    {loading ? <Spinner /> : "Add"}
                                </button>
                                <button
                                    onClick={() => { setShowNewProject(false); setNewProjectName(""); }}
                                    style={{
                                        padding: "6px 10px", borderRadius: 99, border: "1px solid var(--border)",
                                        background: "transparent", color: "var(--text-subtle)",
                                        fontSize: "0.82rem", cursor: "pointer",
                                    }}
                                >✕</button>
                            </div>
                        )}
                    </div>
                </section>

                {/* ── Main Task Card ─────────────────────────────────── */}
                {selectedProjectId ? (
                    <div className="app-card" style={{ padding: 0, overflow: "hidden" }}>

                        {/* Card header */}
                        <div style={{
                            padding: "16px 20px", borderBottom: "1px solid var(--border-soft)",
                            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{
                                    width: 8, height: 8, borderRadius: "50%",
                                    background: "var(--primary)", display: "inline-block",
                                    boxShadow: "0 0 8px var(--primary-soft)",
                                }} />
                                <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                                    {selectedProject?.name}
                                </span>
                                <span style={{
                                    fontSize: "0.72rem", padding: "2px 9px", borderRadius: 99,
                                    background: "var(--surface-3)", color: "var(--text-subtle)",
                                    fontWeight: 600, border: "1px solid var(--border)",
                                }}>
                                    {tasks.length} tasks
                                </span>
                            </div>

                            {/* Copy button */}
                            {tasks.length > 0 && (
                                <button
                                    onClick={handleCopy}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 7,
                                        padding: "7px 16px", borderRadius: 10,
                                        border: `1px solid ${copied ? "var(--success)" : "var(--border)"}`,
                                        background: copied ? "var(--success-soft)" : "var(--surface-2)",
                                        color: copied ? "var(--success)" : "var(--text-muted)",
                                        fontSize: "0.8rem", fontWeight: 700, cursor: "pointer",
                                        transition: "all 0.2s",
                                    }}
                                >
                                    {copied ? (
                                        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg> Copied!</>
                                    ) : (
                                        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg> Copy</>
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Add task input */}
                        <form onSubmit={handleAddTask} style={{
                            padding: "12px 20px", borderBottom: "1px solid var(--border-soft)",
                            display: "flex", gap: 10,
                        }}>
                            <input
                                ref={taskInputRef}
                                value={newTaskTitle}
                                onChange={e => setNewTaskTitle(e.target.value)}
                                placeholder="Add a new task…"
                                style={{
                                    flex: 1, padding: "9px 14px", borderRadius: 10,
                                    border: "1px solid var(--border)", background: "var(--surface-3)",
                                    color: "var(--text)", outline: "none", fontSize: "0.9rem",
                                    fontFamily: "inherit", fontWeight: 500, transition: "border-color 0.2s",
                                }}
                                onFocus={e => (e.target.style.borderColor = "var(--primary)")}
                                onBlur={e => (e.target.style.borderColor = "var(--border)")}
                            />
                            <button
                                type="submit"
                                disabled={!newTaskTitle.trim() || loading}
                                style={{
                                    padding: "9px 20px", borderRadius: 10, border: "none",
                                    background: newTaskTitle.trim() ? "var(--primary)" : "var(--surface-3)",
                                    color: newTaskTitle.trim() ? "#fff" : "var(--text-subtle)",
                                    fontWeight: 700, fontSize: "0.88rem", cursor: newTaskTitle.trim() ? "pointer" : "default",
                                    transition: "all 0.2s", fontFamily: "inherit",
                                }}
                            >
                                {loading ? <Spinner /> : "Add"}
                            </button>
                        </form>

                        {/* Task list */}
                        {tasksLoading ? (
                            <div style={{ padding: 40, display: "flex", justifyContent: "center" }}>
                                <Spinner />
                            </div>
                        ) : tasks.length === 0 ? (
                            <div style={{
                                padding: "48px 20px", textAlign: "center",
                                color: "var(--text-subtle)", fontSize: "0.88rem",
                            }}>
                                <div style={{ fontSize: "2.5rem", marginBottom: 10, opacity: 0.4 }}>✅</div>
                                No tasks yet. Add one above!
                            </div>
                        ) : (
                            <div>
                                {/* PENDING section */}
                                {pendingTasks.length > 0 && (
                                    <div>
                                        <div style={{
                                            padding: "8px 20px 4px",
                                            fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.12em",
                                            textTransform: "uppercase", color: "var(--warning)",
                                            display: "flex", alignItems: "center", gap: 7,
                                        }}>
                                            <span style={{
                                                width: 6, height: 6, borderRadius: "50%",
                                                background: "var(--warning)", display: "inline-block",
                                            }} />
                                            Pending · {pendingTasks.length}
                                        </div>
                                        {pendingTasks.map((task, i) => (
                                            <TaskRow key={task.id} task={task} index={i} onToggle={handleToggle} onDelete={handleDelete} />
                                        ))}
                                    </div>
                                )}

                                {/* DONE section */}
                                {doneTasks.length > 0 && (
                                    <div>
                                        <div style={{
                                            padding: "8px 20px 4px",
                                            fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.12em",
                                            textTransform: "uppercase", color: "var(--success)",
                                            display: "flex", alignItems: "center", gap: 7,
                                            borderTop: pendingTasks.length > 0 ? "1px solid var(--border-soft)" : undefined,
                                            marginTop: pendingTasks.length > 0 ? 4 : 0,
                                        }}>
                                            <span style={{
                                                width: 6, height: 6, borderRadius: "50%",
                                                background: "var(--success)", display: "inline-block",
                                            }} />
                                            Done · {doneTasks.length}
                                        </div>
                                        {doneTasks.map((task, i) => (
                                            <TaskRow key={task.id} task={task} index={i} onToggle={handleToggle} onDelete={handleDelete} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Footer note */}
                        {tasks.length > 0 && (
                            <div style={{
                                padding: "10px 20px", borderTop: "1px solid var(--border-soft)",
                                fontSize: "0.7rem", color: "var(--text-subtle)", textAlign: "center",
                            }}>
                                ✦ Done tasks are hidden 24 hours after creation
                            </div>
                        )}
                    </div>
                ) : (
                    /* No project selected */
                    <div className="app-card" style={{
                        padding: "60px 20px", textAlign: "center",
                        color: "var(--text-subtle)", fontSize: "0.9rem",
                    }}>
                        <div style={{ fontSize: "3rem", marginBottom: 12, opacity: 0.3 }}>📁</div>
                        <p style={{ fontWeight: 600, marginBottom: 6 }}>No project selected</p>
                        <p style={{ fontSize: "0.8rem" }}>Create or select a project above to get started</p>
                    </div>
                )}
            </div>

            {toast && <Toast msg={toast} onDone={() => setToast("")} />}

            {confirmDelete && (
                <ConfirmModal
                    title={`Hapus "${confirmDelete.name}"?`}
                    message={`Semua task di project ini juga akan dihapus. Tindakan ini tidak bisa dibatalkan.`}
                    onConfirm={handleDeleteProject}
                    onCancel={() => setConfirmDelete(null)}
                    loading={deleting}
                />
            )}
        </div>
    );
}

// ── Task Row Component ─────────────────────────────────────────
function TaskRow({
    task, index, onToggle, onDelete,
}: {
    task: Task;
    index: number;
    onToggle: (t: Task) => void;
    onDelete: (id: string) => void;
}) {
    const isDone = task.status === "DONE";
    return (
        <div
            className="task-row"
            style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 20px",
                borderBottom: "1px solid var(--border-soft)",
                animation: "fadeInUp 0.25s ease",
                opacity: isDone ? 0.7 : 1,
            }}
        >
            {/* Checkbox */}
            <div
                className={`check-box${isDone ? " done" : ""}`}
                onClick={() => onToggle(task)}
                title={isDone ? "Mark as pending" : "Mark as done"}
            >
                {isDone && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                )}
            </div>

            {/* Title */}
            <span style={{
                flex: 1, fontSize: "0.9rem", fontWeight: 500, lineHeight: 1.4,
                color: "var(--text)",
                textDecoration: isDone ? "line-through" : "none",
                textDecorationColor: "var(--text-subtle)",
            }}>
                <span style={{
                    fontSize: "0.7rem", fontWeight: 700, color: "var(--text-subtle)",
                    marginRight: 6, fontVariantNumeric: "tabular-nums",
                }}>
                    {index + 1}.
                </span>
                {task.title}
            </span>

            {/* Delete button */}
            <button
                className="btn-icon task-del"
                onClick={() => onDelete(task.id)}
                title="Delete task"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                </svg>
            </button>
        </div>
    );
}
