"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import BrandMark from "@/components/BrandMark";
import { Loader2, Trash2, Shield, UserPlus, Users } from "lucide-react";

interface UserRow {
  email: string;
  role: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function AdminPage() {
  const { token, role, email: currentEmail, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state for inviting
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "user" | "guest">("user");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!loading && role !== "admin") {
      router.push("/");
      return;
    }
  }, [loading, isAuthenticated, role, router]);

  const fetchUsers = async () => {
    if (!token) return;
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to fetch users");
      }
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch users");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (token && role === "admin") {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to create user");
      }
      setFormSuccess(`User ${newEmail} created`);
      setNewEmail("");
      setNewPassword("");
      setNewRole("user");
      fetchUsers();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to delete user");
      }
      fetchUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  if (loading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB]">
        <Loader2 className="animate-spin text-[#0070E0]" size={32} />
      </div>
    );
  }

  if (!isAuthenticated || role !== "admin") {
    return null; // will redirect
  }

  return (
    <div className="xpay-shell min-h-screen flex flex-col">
      {/* Top bar reuse minimal */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#DCE3EC]">
        <div className="mx-auto w-full max-w-[1400px] px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2">
            <BrandMark />
          </a>
          <nav className="hidden sm:flex items-center gap-6 text-sm">
            <a href="/" className="pb-1 font-medium border-b-2 border-transparent text-[#64748B] hover:text-[#0C2340]">
              Send money
            </a>
            <a href="/admin" className="pb-1 font-medium border-b-2 border-[#0070E0] text-[#0C2340]">
              Admin Panel
            </a>
            <a href="/roi" className="pb-1 font-medium border-b-2 border-transparent text-[#64748B] hover:text-[#0C2340]">
              ROI calculator
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#64748B] hidden sm:inline">{currentEmail} ({role})</span>
          </div>
        </div>
      </header>

      <main className="flex-1 xpay-container py-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E8F1FC] text-[#0070E0]">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0C2340]">Admin Panel</h1>
            <p className="text-sm text-[#64748B]">Manage xPay user credentials — invite or remove access.</p>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-[#B42318]/20 bg-[#FDECEA] px-4 py-3 text-sm text-[#B42318]">
            {error}
          </div>
        )}

        {/* Users table */}
        <div className="mt-8 bg-white border border-[#DCE3EC] rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(12,35,64,.06)]">
          <div className="px-6 py-4 border-b border-[#DCE3EC] flex items-center gap-2">
            <Users size={18} className="text-[#0070E0]" />
            <h2 className="text-sm font-semibold text-[#0C2340]">Current users ({users.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F4F7FB] text-left">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Email</th>
                  <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide">Role</th>
                  <th className="px-6 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE3EC]">
                {users.map((u) => (
                  <tr key={u.email} className="hover:bg-[#F4F7FB]">
                    <td className="px-6 py-3 font-medium text-[#0C2340]">{u.email}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          u.role === "admin"
                            ? "bg-[#FDECEA] text-[#B42318] border-[#B42318]/20"
                            : u.role === "user"
                            ? "bg-[#E8F1FC] text-[#0070E0] border-[#0070E0]/20"
                            : "bg-[#F4F7FB] text-[#64748B] border-[#DCE3EC]"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleDelete(u.email)}
                        disabled={u.email.toLowerCase() === currentEmail?.toLowerCase()}
                        title={
                          u.email.toLowerCase() === currentEmail?.toLowerCase()
                            ? "You cannot delete your own account"
                            : "Delete user"
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE3EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#B42318] hover:bg-[#FDECEA] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && !fetching && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-[#64748B]">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invite form */}
        <div className="mt-8 bg-white border border-[#DCE3EC] rounded-xl p-6 shadow-[0_1px_2px_rgba(12,35,64,.06)]">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={18} className="text-[#0070E0]" />
            <h2 className="text-sm font-semibold text-[#0C2340]">Invite new user</h2>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="newEmail" className="block text-xs font-medium text-[#0C2340] mb-1">
                  Email
                </label>
                <input
                  id="newEmail"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="newuser@xpay.com"
                  className="w-full rounded-lg border border-[#DCE3EC] bg-white px-3 py-2.5 text-sm text-[#0C2340] placeholder:text-[#94A3B8] focus:border-[#0070E0] focus:ring-2 focus:ring-[#0070E0]/20 outline-none"
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-xs font-medium text-[#0C2340] mb-1">
                  Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 chars"
                  className="w-full rounded-lg border border-[#DCE3EC] bg-white px-3 py-2.5 text-sm text-[#0C2340] placeholder:text-[#94A3B8] focus:border-[#0070E0] focus:ring-2 focus:ring-[#0070E0]/20 outline-none"
                />
              </div>
              <div>
                <label htmlFor="newRole" className="block text-xs font-medium text-[#0C2340] mb-1">
                  Role
                </label>
                <select
                  id="newRole"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full rounded-lg border border-[#DCE3EC] bg-white px-3 py-2.5 text-sm text-[#0C2340] focus:border-[#0070E0] focus:ring-2 focus:ring-[#0070E0]/20 outline-none"
                >
                  <option value="admin">admin</option>
                  <option value="user">user</option>
                  <option value="guest">guest</option>
                </select>
              </div>
            </div>

            {formError && (
              <div className="rounded-lg border border-[#B42318]/20 bg-[#FDECEA] px-4 py-2 text-sm text-[#B42318]">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="rounded-lg border border-[#067647]/20 bg-[#E7F6EE] px-4 py-2 text-sm text-[#067647]">
                {formSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0070E0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#005FC2] disabled:opacity-40"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              Invite user
            </button>
          </form>
        </div>
      </main>

      <footer className="border-t border-[#DCE3EC] bg-white">
        <div className="xpay-container py-4 text-center text-xs text-[#64748B]">© 2026 xPay · Simulated demo · Admin access required for user management.</div>
      </footer>
    </div>
  );
}
