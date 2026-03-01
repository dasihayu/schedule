"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        setLoading(false);

        if (result?.error) {
            setError("Invalid email or password. Please try again.");
        } else {
            router.push("/");
            router.refresh();
        }
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg)",
                padding: "24px",
            }}
        >
            <div style={{ width: "100%", maxWidth: 400 }}>
                {/* Logo / Title */}
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <div
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 14,
                            background: "var(--primary-soft)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 16px",
                            border: "1px solid var(--primary-ring)",
                        }}
                    >
                        <span style={{ fontSize: 22 }}>📋</span>
                    </div>
                    <h1
                        style={{
                            fontSize: "1.4rem",
                            fontWeight: 700,
                            letterSpacing: "-0.02em",
                            marginBottom: 4,
                        }}
                    >
                        Work Attendance
                    </h1>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        Sign in to your account
                    </p>
                </div>

                {/* Card */}
                <div
                    style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 20,
                        padding: "28px 28px",
                        boxShadow: "var(--shadow-md)",
                    }}
                >
                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* Email */}
                        <div>
                            <label
                                htmlFor="email"
                                style={{
                                    display: "block",
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    color: "var(--text-muted)",
                                    marginBottom: 6,
                                }}
                            >
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                style={{
                                    width: "100%",
                                    background: "var(--surface-2)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 10,
                                    padding: "10px 14px",
                                    fontSize: "0.88rem",
                                    color: "var(--text)",
                                    outline: "none",
                                    transition: "border-color 0.15s",
                                }}
                                onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label
                                htmlFor="password"
                                style={{
                                    display: "block",
                                    fontSize: "0.78rem",
                                    fontWeight: 600,
                                    color: "var(--text-muted)",
                                    marginBottom: 6,
                                }}
                            >
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                required
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{
                                    width: "100%",
                                    background: "var(--surface-2)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 10,
                                    padding: "10px 14px",
                                    fontSize: "0.88rem",
                                    color: "var(--text)",
                                    outline: "none",
                                    transition: "border-color 0.15s",
                                }}
                                onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div
                                style={{
                                    background: "var(--danger-soft)",
                                    border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
                                    borderRadius: 8,
                                    padding: "10px 14px",
                                    fontSize: "0.8rem",
                                    color: "var(--danger)",
                                }}
                            >
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: "100%",
                                padding: "11px",
                                borderRadius: 10,
                                background: loading ? "var(--primary-soft)" : "var(--primary)",
                                color: loading ? "var(--primary)" : "#fff",
                                border: "none",
                                fontSize: "0.9rem",
                                fontWeight: 600,
                                cursor: loading ? "not-allowed" : "pointer",
                                transition: "opacity 0.15s",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                            }}
                        >
                            {loading ? (
                                <>
                                    <div
                                        style={{
                                            width: 14,
                                            height: 14,
                                            border: "2px solid var(--primary)",
                                            borderTopColor: "transparent",
                                            borderRadius: "50%",
                                            animation: "spin 0.7s linear infinite",
                                        }}
                                    />
                                    Signing in...
                                </>
                            ) : (
                                "Sign In"
                            )}
                        </button>
                    </form>

                    {/* Register link */}
                    <p
                        style={{
                            textAlign: "center",
                            marginTop: 20,
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                        }}
                    >
                        Don&apos;t have an account?{" "}
                        <Link
                            href="/register"
                            style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}
                        >
                            Create one →
                        </Link>
                    </p>
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
    );
}
