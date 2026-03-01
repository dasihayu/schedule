"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Registration failed");
            } else {
                router.push("/login?registered=1");
            }
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        width: "100%",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: "0.88rem",
        color: "var(--text)",
        outline: "none",
        transition: "border-color 0.15s",
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
                    <h1 style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
                        Create Account
                    </h1>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        Start tracking your work hours
                    </p>
                </div>

                <div
                    style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 20,
                        padding: "28px",
                        boxShadow: "var(--shadow-md)",
                    }}
                >
                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {/* Name */}
                        <div>
                            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                                Full Name
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="John Doe"
                                style={inputStyle}
                                onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                style={inputStyle}
                                onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>
                                Password <span style={{ color: "var(--text-subtle)", fontWeight: 400 }}>(min. 6 chars)</span>
                            </label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={inputStyle}
                                onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
                                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                            />
                        </div>

                        {error && (
                            <div style={{ background: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)", borderRadius: 8, padding: "10px 14px", fontSize: "0.8rem", color: "var(--danger)" }}>
                                {error}
                            </div>
                        )}

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
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                            }}
                        >
                            {loading ? (
                                <>
                                    <div style={{ width: 14, height: 14, border: "2px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                                    Creating account...
                                </>
                            ) : "Create Account"}
                        </button>
                    </form>

                    <p style={{ textAlign: "center", marginTop: 20, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        Already have an account?{" "}
                        <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
                            Sign in →
                        </Link>
                    </p>
                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
    );
}
