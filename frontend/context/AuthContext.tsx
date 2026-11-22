"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Role = "admin" | "user" | "guest" | null;

interface AuthState {
  token: string | null;
  role: Role;
  email: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "http://localhost:8000";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("xpay_token");
    const storedRole = localStorage.getItem("xpay_role") as Role;
    const storedEmail = localStorage.getItem("xpay_email");
    if (storedToken) {
      setToken(storedToken);
      setRole(storedRole);
      setEmail(storedEmail);
    }
    setLoading(false);
  }, []);

  const login = async (emailInput: string, password: string) => {
    // OAuth2PasswordRequestForm expects application/x-www-form-urlencoded with username & password
    const formData = new URLSearchParams();
    formData.append("username", emailInput);
    formData.append("password", password);

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });
    } catch (e) {
      // Network-level failure (backend down, CORS, DB not running)
      const base = API_BASE || "(same-origin via /token proxy)";
      throw new Error(
        `Failed to fetch (${base}/token) — is the backend running? ` +
          `Try: docker compose up --build  OR  cd backend && alembic upgrade head && python scripts/migrate_json_to_db.py && uvicorn app.main:app --reload --port 8000  ` +
          `Then check http://localhost:8000/api/health — ` +
          (e instanceof Error ? e.message : String(e))
      );
    }

    if (!res.ok) {
      let detail = "Login failed";
      try {
        const err = await res.json();
        detail = err.detail || detail;
      } catch {}
      throw new Error(detail);
    }

    const data = await res.json();
    const newToken: string = data.access_token;
    const newRole: Role = data.role;
    const newEmail: string = data.email;

    // Persist to state + localStorage + cookie (for middleware if ever used)
    setToken(newToken);
    setRole(newRole);
    setEmail(newEmail);
    localStorage.setItem("xpay_token", newToken);
    localStorage.setItem("xpay_role", newRole ?? "");
    localStorage.setItem("xpay_email", newEmail ?? "");
    // Also set cookie for potential middleware/SSR (not strictly required but helpful)
    document.cookie = `xpay_token=${newToken}; path=/; max-age=${60 * 60 * 24 * 7}`;
  };

  const logout = () => {
    setToken(null);
    setRole(null);
    setEmail(null);
    localStorage.removeItem("xpay_token");
    localStorage.removeItem("xpay_role");
    localStorage.removeItem("xpay_email");
    // Clear cookie
    document.cookie = "xpay_token=; path=/; max-age=0";
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ token, role, email, isAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
