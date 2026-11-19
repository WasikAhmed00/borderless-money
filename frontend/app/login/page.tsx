"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import BrandMark from "@/components/BrandMark";
import { Loader2, Shield, Info } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push("/");
    }
  }, [loading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB]">
        <Loader2 className="animate-spin text-[#0070E0]" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7FB]">
      {/* Simple top bar with brand */}
      <header className="bg-white border-b border-[#DCE3EC]">
        <div className="mx-auto w-full max-w-[1400px] px-6 sm:px-8 lg:px-12 h-16 flex items-center">
          <a href="/" className="flex items-center gap-2">
            <BrandMark />
          </a>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px]">
          <div className="bg-white border border-[#DCE3EC] rounded-xl p-8 shadow-[0_1px_2px_rgba(12,35,64,.06)]">
            <div className="flex justify-center mb-6">
              <BrandMark />
            </div>
            <h1 className="text-2xl font-bold text-[#0C2340] text-center">Welcome to xPay</h1>
            <p className="text-sm text-[#64748B] text-center mt-2">Sign in to access your remittance dashboard</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#0C2340] mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@xpay.com"
                  className="w-full rounded-lg border border-[#DCE3EC] bg-white px-4 py-3 text-sm text-[#0C2340] placeholder:text-[#94A3B8] focus:border-[#0070E0] focus:ring-2 focus:ring-[#0070E0]/20 outline-none"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[#0C2340] mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-[#DCE3EC] bg-white px-4 py-3 text-sm text-[#0C2340] placeholder:text-[#94A3B8] focus:border-[#0070E0] focus:ring-2 focus:ring-[#0070E0]/20 outline-none"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-[#B42318]/20 bg-[#FDECEA] px-4 py-3 text-sm text-[#B42318]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0070E0] text-sm font-semibold text-white hover:bg-[#005FC2] active:bg-[#00429A] disabled:opacity-40 transition"
              >
                {busy ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            {/* Demo credentials helper */}
            <div className="mt-8 rounded-lg bg-[#F4F7FB] border border-[#DCE3EC] p-4">
              <p className="text-xs font-semibold text-[#0C2340] flex items-center gap-2">
                <Info size={14} /> Demo credentials
              </p>
              <div className="mt-3 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Admin:</span>
                  <span className="text-[#0C2340]">admin@xpay.com / AdminPass123!</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">User:</span>
                  <span className="text-[#0C2340]">user@xpay.com / UserPass123!</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Guest:</span>
                  <span className="text-[#0C2340]">guest@xpay.com / GuestPass123!</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-[#94A3B8] mt-6">
            Demo environment — quotes are simulated snapshots.
          </p>
        </div>
      </main>
    </div>
  );
}
