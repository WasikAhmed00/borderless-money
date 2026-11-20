"use client";

import { useEffect, useState, useRef } from "react";
import BrandMark from "@/components/BrandMark";
import { useAuth } from "@/context/AuthContext";
import {
  Shield,
  Users,
  BarChart3,
  FileText,
  Server,
  GitBranch,
  Lock,
  Settings,
  X,
  Plus,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
  Zap,
  Eye,
} from "lucide-react";

// Types
interface DocsConfig {
  is_public: boolean;
  start_time: string | null;
  end_time: string | null;
}

interface LiveData {
  total_users: number;
  total_quotes: number;
  mcp_status: string;
  mcp_server: string;
  transport: string;
  timestamp: string;
}

interface TeamMember {
  id: number;
  name: string;
  role: string;
  email: string;
  image_url: string | null;
  order_index: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

// Helper to check if current time is within window
function isWithinWindow(cfg: DocsConfig): boolean {
  const now = new Date();
  if (cfg.start_time && new Date(cfg.start_time) > now) return false;
  if (cfg.end_time && new Date(cfg.end_time) < now) return false;
  return cfg.is_public;
}

export default function DocsPage() {
  const { token, role, isAuthenticated } = useAuth();
  const isAdmin = role === "admin" && isAuthenticated;
  const [config, setConfig] = useState<DocsConfig | null>(null);
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdminDrawer, setShowAdminDrawer] = useState(false);
  const [mermaidRendered, setMermaidRendered] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Admin form state
  const [editPublic, setEditPublic] = useState(true);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [newMember, setNewMember] = useState({ name: "", role: "", email: "", image_url: "", order_index: 0 });
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);

  // Fetch config, live-data, team
  useEffect(() => {
    async function fetchAll() {
      try {
        const [cfgRes, liveRes, teamRes] = await Promise.all([
          fetch(`${API_BASE}/api/docs/config`),
          fetch(`${API_BASE}/api/docs/live-data`),
          fetch(`${API_BASE}/api/docs/team`),
        ]);
        if (!cfgRes.ok) throw new Error(`config: ${cfgRes.status}`);
        const cfg = await cfgRes.json();
        setConfig(cfg);
        setEditPublic(cfg.is_public);
        setEditStart(cfg.start_time ? new Date(cfg.start_time).toISOString().slice(0, 16) : "");
        setEditEnd(cfg.end_time ? new Date(cfg.end_time).toISOString().slice(0, 16) : "");
        if (liveRes.ok) setLiveData(await liveRes.json());
        if (teamRes.ok) setTeam(await teamRes.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  // Mermaid render
  useEffect(() => {
    if (mermaidRendered) return;
    const renderMermaid = async () => {
      // Try to load mermaid from CDN if not already loaded
      if (typeof window !== "undefined" && !(window as any).mermaid) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
        script.onload = () => {
          (window as any).mermaid.initialize({ startOnLoad: false, theme: "base", themeVariables: { primaryColor: "#E8F1FC", primaryBorderColor: "#0070E0", lineColor: "#0C2340" } });
          setMermaidRendered(true);
        };
        script.onerror = () => setMermaidRendered(false);
        document.head.appendChild(script);
      } else if ((window as any).mermaid) {
        setMermaidRendered(true);
      }
    };
    renderMermaid();
  }, [mermaidRendered]);

  useEffect(() => {
    if (mermaidRendered && typeof window !== "undefined" && (window as any).mermaid) {
      try {
        (window as any).mermaid.run({ querySelector: ".mermaid" });
      } catch {}
    }
  }, [mermaidRendered, config, liveData]);

  // Access control: 403 if not public / outside window and not admin
  const isBlocked = config ? (!config.is_public || !isWithinWindow(config)) : false;
  const show403 = isBlocked && !isAdmin;

  const handleSaveConfig = async () => {
    setAdminSaving(true);
    setAdminMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/docs/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          is_public: editPublic,
          start_time: editStart ? new Date(editStart).toISOString() : null,
          end_time: editEnd ? new Date(editEnd).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to save");
      const updated = await res.json();
      setConfig(updated);
      setAdminMsg("Config saved");
    } catch (e) {
      setAdminMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setAdminSaving(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminSaving(true);
    setAdminMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/docs/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newMember),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to add");
      const created = await res.json();
      setTeam([...team, created].sort((a, b) => a.order_index - b.order_index));
      setNewMember({ name: "", role: "", email: "", image_url: "", order_index: 0 });
      setAdminMsg(`Added ${created.name}`);
    } catch (e) {
      setAdminMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setAdminSaving(false);
    }
  };

  const handleDeleteMember = async (id: number) => {
    if (!confirm("Remove this team member?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/docs/team/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to delete");
      setTeam(team.filter((m) => m.id !== id));
      setAdminMsg("Member removed");
    } catch (e) {
      setAdminMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    // Dynamic import html2pdf.js from CDN
    const scriptId = "html2pdf-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      document.head.appendChild(script);
      await new Promise((res, rej) => {
        script.onload = () => res(null);
        script.onerror = () => rej(new Error("Failed to load html2pdf"));
      });
    }
    const html2pdf = (window as any).html2pdf;
    if (!html2pdf) {
      alert("PDF export unavailable — html2pdf not loaded");
      return;
    }
    html2pdf()
      .set({ margin: 10, filename: "xPay-docs.pdf", image: { type: "jpeg", quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" } })
      .from(contentRef.current)
      .save();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB]">
        <div className="animate-pulse text-[#64748B] text-sm">Loading docs...</div>
      </div>
    );
  }

  if (show403) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F4F7FB]">
        <header className="bg-white border-b border-[#DCE3EC] sticky top-0 z-10">
          <div className="mx-auto w-full max-w-[1400px] px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <BrandMark />
            </a>
            <a href="/" className="text-sm font-medium text-[#0070E0] hover:text-[#005FC2]">
              ← Back to app
            </a>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="max-w-[560px] w-full bg-white border border-[#DCE3EC] rounded-xl p-8 text-center shadow-[0_1px_2px_rgba(12,35,64,.06)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FDECEA] text-[#B42318] mb-4">
              <Lock size={28} />
            </div>
            <h1 className="text-2xl font-bold text-[#0C2340]">Documentation Unavailable</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#64748B]">
              The live documentation is currently private or outside its scheduled window.
              {config?.start_time && (
                <>
                  <br />
                  Window: {new Date(config.start_time).toLocaleString()} —{" "}
                  {config?.end_time ? new Date(config.end_time).toLocaleString() : "open ended"}
                </>
              )}
              <br />
              Public: {config?.is_public ? "Yes" : "No"} · Now: {new Date().toLocaleString()}
            </p>
            <p className="mt-4 text-xs text-[#94A3B8]">
              If you are an Admin, sign in to bypass this check and edit the schedule.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <a href="/login" className="rounded-lg bg-[#0070E0] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#005FC2]">
                Sign in as Admin
              </a>
              <a href="/" className="rounded-lg border border-[#DCE3EC] bg-white px-5 py-2.5 text-sm font-semibold text-[#0C2340] hover:bg-[#F4F7FB]">
                Go to app
              </a>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Main YC-style docs layout
  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-[#DCE3EC] sticky top-0 z-20">
        <div className="mx-auto w-full max-w-[1400px] px-6 sm:px-8 lg:px-12 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center">
              <BrandMark />
            </a>
            <span className="hidden sm:inline-flex items-center gap-2 rounded-full bg-[#0C2340] px-3 py-1 text-xs font-semibold text-white">
              <FileText size={12} /> Live Docs
            </span>
            {config && (
              <span className={`hidden md:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${config.is_public ? "bg-[#E7F6EE] text-[#067647] border-[#067647]/20" : "bg-[#FDECEA] text-[#B42318] border-[#B42318]/20"}`}>
                {config.is_public ? <Eye size={12} /> : <Lock size={12} />} {config.is_public ? "Public" : "Private"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportPDF}
              className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-[#DCE3EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#0C2340] hover:bg-[#F4F7FB]"
            >
              <Download size={14} /> PDF
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowAdminDrawer(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0C2340] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#33415C]"
              >
                <Settings size={14} /> Admin
              </button>
            )}
            <a href="/" className="hidden sm:inline text-sm font-medium text-[#64748B] hover:text-[#0C2340]">
              ← App
            </a>
          </div>
        </div>
      </header>

      <div className="flex-1 mx-auto w-full max-w-[1400px] px-6 sm:px-8 lg:px-12 py-8 flex flex-col lg:flex-row gap-8">
        {/* Sticky left sidebar — YC style */}
        <aside className="hidden lg:block w-[220px] shrink-0">
          <div className="sticky top-24 space-y-6">
            <nav className="space-y-1 text-sm">
              <p className="px-3 py-2 text-xs font-semibold tracking-widest text-[#94A3B8] uppercase">Pitch Deck</p>
              <a href="#problem" className="block px-3 py-1.5 rounded-lg text-[#33415C] hover:bg-white hover:text-[#0C2340] border border-transparent hover:border-[#DCE3EC]">
                Problem
              </a>
              <a href="#solution" className="block px-3 py-1.5 rounded-lg text-[#33415C] hover:bg-white hover:text-[#0C2340] border border-transparent hover:border-[#DCE3EC]">
                Solution
              </a>
              <a href="#why-now" className="block px-3 py-1.5 rounded-lg text-[#33415C] hover:bg-white hover:text-[#0C2340] border border-transparent hover:border-[#DCE3EC]">
                Why Now
              </a>
              <a href="#competition" className="block px-3 py-1.5 rounded-lg text-[#33415C] hover:bg-white hover:text-[#0C2340] border border-transparent hover:border-[#DCE3EC]">
                Competition
              </a>
              <a href="#traction" className="block px-3 py-1.5 rounded-lg bg-[#E8F1FC] text-[#0C2340] border border-[#0070E0]/20 font-medium flex items-center gap-2">
                <BarChart3 size={14} /> Live Traction
              </a>
              <p className="px-3 py-2 mt-4 text-xs font-semibold tracking-widest text-[#94A3B8] uppercase">Team</p>
              <a href="#team" className="block px-3 py-1.5 rounded-lg text-[#33415C] hover:bg-white hover:text-[#0C2340] border border-transparent hover:border-[#DCE3EC]">
                Team
              </a>
              <p className="px-3 py-2 mt-4 text-xs font-semibold tracking-widest text-[#94A3B8] uppercase">Whitepaper</p>
              <a href="#architecture" className="block px-3 py-1.5 rounded-lg text-[#33415C] hover:bg-white hover:text-[#0C2340] border border-transparent hover:border-[#DCE3EC]">
                Architecture
              </a>
              <a href="#data-flow" className="block px-3 py-1.5 rounded-lg text-[#33415C] hover:bg-white hover:text-[#0C2340] border border-transparent hover:border-[#DCE3EC]">
                Data Flow
              </a>
              <a href="#stack" className="block px-3 py-1.5 rounded-lg text-[#33415C] hover:bg-white hover:text-[#0C2340] border border-transparent hover:border-[#DCE3EC]">
                Tech Stack
              </a>
              <a href="#api-docs" className="block px-3 py-1.5 rounded-lg text-[#33415C] hover:bg-white hover:text-[#0C2340] border border-transparent hover:border-[#DCE3EC]">
                API Docs
              </a>
            </nav>
            <div className="rounded-xl bg-[#0C2340] p-4 text-white">
              <p className="text-xs font-semibold">xPay — Borderless Money</p>
              <p className="mt-1 text-xs leading-relaxed text-white/70">
                AI-assisted remittance intelligence. Deterministic math, explainable routing, MCP read-only.
              </p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main ref={contentRef} className="flex-1 min-w-0 space-y-8">
          {/* Hero */}
          <div className="bg-white border border-[#DCE3EC] rounded-xl p-6 sm:p-8 shadow-[0_1px_2px_rgba(12,35,64,.06)]">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#E8F1FC] border border-[#0070E0]/20 px-3 py-1 text-xs font-semibold text-[#0070E0]">
              <Zap size={12} /> YC-Style Live Documentation
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-[#0C2340]">xPay — Make every taka count.</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#33415C] max-w-[720px]">
              Migrant workers lose 3–6% to hidden FX spreads and fees. xPay ranks every eligible rail by the <strong className="text-[#0C2340]">exact taka that arrives</strong> — fees out, 2.5% Bangladesh Bank incentive in — with deterministic Decimal math and explainable compliance. Live metrics below are from PostgreSQL (AsyncSession), not JSON snapshots.
            </p>
            {error && (
              <div className="mt-4 rounded-lg border border-[#B42318]/20 bg-[#FDECEA] px-3 py-2 text-xs text-[#B42318] flex items-center gap-2">
                <AlertTriangle size={14} /> {error}
              </div>
            )}
          </div>

          {/* Section 1 — Pitch Deck */}
          <section id="problem" className="bg-white border border-[#DCE3EC] rounded-xl p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-[#0C2340] flex items-center gap-2">
              <Globe size={18} className="text-[#0070E0]" /> Problem
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#33415C]">
              Bangladesh received &gt; $20B in remittances annually; the UAE corridor (AED→BDT) is high-volume but opaque. Workers sending 1,000 AED home lose 30–60 AED to <strong>hidden FX markups and stacked fees</strong>, and payout rails (bKash, Nagad, bank) have different settlement times and incentive eligibility. Existing apps show headline fees, not the <em>net taka that arrives</em>.
            </p>
          </section>

          <section id="solution" className="bg-white border border-[#DCE3EC] rounded-xl p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-[#0C2340] flex items-center gap-2">
              <CheckCircle size={18} className="text-[#067647]" /> Solution
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#33415C]">
              <strong>AI-assisted net-receive optimization:</strong> Parse intent (EN/BN/voice) → price every eligible rail end-to-end (FX × principal − fees + incentive) with <code className="rounded bg-[#F4F7FB] border border-[#DCE3EC] px-1 font-mono text-xs">Decimal(ROUND_HALF_UP)</code> → rank by reliability-adjusted net → explain trade-offs → bind quote (60-min TTL, Idempotency-Key) → simulated settlement. The user confirms the exact quoted route before money moves.
            </p>
            <div className="mt-4 grid sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-[#F4F7FB] border border-[#DCE3EC] p-3">
                <p className="text-xs font-semibold text-[#0C2340]">Net, not fee</p>
                <p className="text-xs text-[#64748B] mt-1">True net receive in BDT, incentive-aware.</p>
              </div>
              <div className="rounded-lg bg-[#F4F7FB] border border-[#DCE3EC] p-3">
                <p className="text-xs font-semibold text-[#0C2340]">Explainable</p>
                <p className="text-xs text-[#64748B] mt-1">Plain-language reasoning log, not black-box.</p>
              </div>
              <div className="rounded-lg bg-[#F4F7FB] border border-[#DCE3EC] p-3">
                <p className="text-xs font-semibold text-[#0C2340]">Compliance-first</p>
                <p className="text-xs text-[#64748B] mt-1">OFAC fuzzy + GNN risk before quote.</p>
              </div>
            </div>
          </section>

          <section id="why-now" className="bg-white border border-[#DCE3EC] rounded-xl p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-[#0C2340] flex items-center gap-2">
              <Clock size={18} className="text-[#0070E0]" /> Why Now
            </h2>
            <ul className="mt-3 list-disc pl-5 space-y-1 text-sm leading-relaxed text-[#33415C]">
              <li>
                <strong>Open banking</strong> — rail pricing and payout APIs are now data-driven (corridors as JSON, `config/corridors/*.json`).
              </li>
              <li>
                <strong>MCP standardization</strong> — Model Context Protocol gives a read-only, auditable tool layer (`xpay-financial-intelligence-mcp` on 8001, Streamable HTTP) separating AI from deterministic finance.
              </li>
              <li>
                <strong>Bangladesh Bank incentive</strong> — 2.5% formal-channel incentive is policy, not promo; routing must be incentive-aware.
              </li>
            </ul>
          </section>

          <section id="competition" className="bg-white border border-[#DCE3EC] rounded-xl p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-[#0C2340]">Competition</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#DCE3EC] text-left">
                    <th className="py-2 pr-4 text-xs font-semibold text-[#64748B] uppercase">Feature</th>
                    <th className="py-2 px-3 text-xs font-semibold text-[#0C2340]">xPay</th>
                    <th className="py-2 px-3 text-xs font-semibold text-[#64748B]">Wise / Remitly</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE3EC]">
                  <tr>
                    <td className="py-2 pr-4 text-[#33415C]">Net-receive math</td>
                    <td className="py-2 px-3 font-medium text-[#067647]">Exact Decimal, incentive-aware</td>
                    <td className="py-2 px-3 text-[#64748B]">Headline fee + spread estimate</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-[#33415C]">Explainability</td>
                    <td className="py-2 px-3 font-medium text-[#067647]">Reasoning log + regulatory citations</td>
                    <td className="py-2 px-3 text-[#64748B]">Limited breakdown</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-[#33415C]">Compliance</td>
                    <td className="py-2 px-3 font-medium text-[#067647]">Jaro-Winkler + token coverage, human-in-loop</td>
                    <td className="py-2 px-3 text-[#64748B]">Opaque</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-[#33415C]">MCP integration</td>
                    <td className="py-2 px-3 font-medium text-[#0070E0]">Read-only FastMCP (5 tools, prompt)</td>
                    <td className="py-2 px-3 text-[#64748B]">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="traction" className="bg-white border border-[#DCE3EC] rounded-xl p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-[#0C2340] flex items-center gap-2">
              <BarChart3 size={18} className="text-[#0070E0]" /> Live Traction
            </h2>
            <p className="mt-1 text-xs text-[#94A3B8]">Live from PostgreSQL (AsyncSession) + MCP probe — {liveData?.timestamp ? new Date(liveData.timestamp).toLocaleString() : "loading..."}</p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl bg-[#F4F7FB] border border-[#DCE3EC] p-4">
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Users</p>
                <p className="mt-1 text-2xl font-bold text-[#0C2340]">{liveData ? liveData.total_users : "—"}</p>
                <p className="text-xs text-[#64748B] mt-1">Total registered (admin/user/guest)</p>
              </div>
              <div className="rounded-xl bg-[#F4F7FB] border border-[#DCE3EC] p-4">
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Quotes Generated</p>
                <p className="mt-1 text-2xl font-bold text-[#0C2340]">{liveData ? liveData.total_quotes : "—"}</p>
                <p className="text-xs text-[#64748B] mt-1">In-memory quotes (deterministic)</p>
              </div>
              <div className="rounded-xl border p-4" style={{ background: liveData?.mcp_status === "Active" ? "#E7F6EE" : "#FDECEA", borderColor: liveData?.mcp_status === "Active" ? "#06764720" : "#B4231820" }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: liveData?.mcp_status === "Active" ? "#067647" : "#B42318" }}>
                  MCP Status
                </p>
                <p className="mt-1 text-lg font-bold flex items-center gap-2" style={{ color: liveData?.mcp_status === "Active" ? "#067647" : "#B42318" }}>
                  {liveData?.mcp_status === "Active" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />} {liveData ? liveData.mcp_status : "—"}
                </p>
                <p className="text-xs mt-1" style={{ color: liveData?.mcp_status === "Active" ? "#067647" : "#B42318" }}>
                  {liveData?.mcp_server || "xpay-financial-intelligence-mcp"} · {liveData?.transport || "Streamable HTTP"}
                </p>
              </div>
            </div>
          </section>

          {/* Section 2 — Team */}
          <section id="team" className="bg-white border border-[#DCE3EC] rounded-xl p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-[#0C2340] flex items-center gap-2">
              <Users size={18} className="text-[#0070E0]" /> Team
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">PostgreSQL-backed team grid — Admins can add/remove via the gear drawer.</p>
            {team.length === 0 ? (
              <p className="mt-6 text-sm text-[#64748B]">No team members yet — an Admin can add the first.</p>
            ) : (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {team.map((m) => (
                  <div key={m.id} className="rounded-xl border border-[#DCE3EC] bg-[#F4F7FB] p-4 flex flex-col items-center text-center">
                    {m.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.image_url} alt={m.name} className="h-20 w-20 aspect-square object-cover rounded-full border-2 border-white shadow-sm" />
                    ) : (
                      <div className="h-20 w-20 aspect-square rounded-full bg-[#0C2340] text-white flex items-center justify-center text-xl font-bold">
                        {m.name
                          .split(" ")
                          .map((p) => p[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <p className="mt-3 text-sm font-semibold text-[#0C2340]">{m.name}</p>
                    <p className="text-xs font-medium text-[#0070E0]">{m.role}</p>
                    <p className="text-xs text-[#64748B] mt-1 break-all">{m.email}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 3 — Whitepaper */}
          <section id="architecture" className="bg-white border border-[#DCE3EC] rounded-xl p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-[#0C2340] flex items-center gap-2">
              <Server size={18} className="text-[#0C2340]" /> Architecture
            </h2>
            <p className="mt-1 text-xs text-[#94A3B8]">Next.js → FastAPI (JWT) → PostgreSQL + LangGraph → MCP (8001) → External APIs · Rendered via Mermaid.js</p>
            <div className="mt-4 rounded-lg border border-[#DCE3EC] bg-[#F4F7FB] p-4 overflow-x-auto">
              <pre className="mermaid text-sm">
                {`graph TB
  A[Next.js 14<br/>App Router + Tailwind<br/>JWT via AuthContext] --> B[FastAPI<br/>JWT Auth + RBAC<br/>:8000]
  B --> C[(PostgreSQL 16<br/>Async SQLAlchemy<br/>Users + DocsConfig + Team)]
  B --> D[LangGraph Orchestrator<br/>StateGraph + Fallback]
  D --> E[MCP Server<br/>FastMCP :8001<br/>Streamable HTTP]
  E --> F1[corridor / FX]
  E --> F2[routing_scorer / money<br/>Exact Decimal]
  E --> F3[compliance / Jaro]
  E --> F4[regulatory_rag]
  D --> G[Deterministic Math<br/>No LLM for money]
  G --> H[Quote Store + Receipt]
  B --> I[Docker Compose<br/>db + backend + mcp + frontend]
`}
              </pre>
              {!mermaidRendered && <p className="mt-2 text-xs text-[#94A3B8]">Mermaid loading...</p>}
            </div>
          </section>

          <section id="data-flow" className="bg-white border border-[#DCE3EC] rounded-xl p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-[#0C2340] flex items-center gap-2">
              <GitBranch size={18} className="text-[#0070E0]" /> Data Flow
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="rounded-full bg-[#E8F1FC] border border-[#0070E0]/20 px-3 py-1 text-[#0C2340]">Parse Intent</span>
              <span className="text-[#94A3B8]">→</span>
              <span className="rounded-full bg-[#FFF4E0] border border-[#F59E0B]/20 px-3 py-1 text-[#0C2340]">MCP Tool (Sanctions/FX)</span>
              <span className="text-[#94A3B8]">→</span>
              <span className="rounded-full bg-[#E7F6EE] border border-[#067647]/20 px-3 py-1 text-[#067647]">Deterministic Math (Decimal)</span>
              <span className="text-[#94A3B8]">→</span>
              <span className="rounded-full bg-[#F4F7FB] border border-[#DCE3EC] px-3 py-1 text-[#0C2340]">DB Save</span>
              <span className="text-[#94A3B8]">→</span>
              <span className="rounded-full bg-[#0C2340] text-white px-3 py-1">Response</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#33415C]">
              Every quote is priced with <code className="rounded bg-[#F4F7FB] border border-[#DCE3EC] px-1 font-mono text-xs">Decimal(ROUND_HALF_UP)</code> before any DB write. The MCP server is read-only — it can query FX, routes, screening, and guidance, but never mutates the quote store or ledger. PostgreSQL (via <code className="rounded bg-[#F4F7FB] border border-[#DCE3EC] px-1 font-mono text-xs">AsyncSession</code>) is the source of truth for <code className="rounded bg-[#F4F7FB] border border-[#DCE3EC] px-1 font-mono text-xs">users</code>, <code className="rounded bg-[#F4F7FB] border border-[#DCE3EC] px-1 font-mono text-xs">docs_config</code>, and <code className="rounded bg-[#F4F7FB] border border-[#DCE3EC] px-1 font-mono text-xs">team_members</code>.
            </p>
          </section>

          <section id="stack" className="bg-white border border-[#DCE3EC] rounded-xl p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-[#0C2340]">Tech Stack</h2>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                "Next.js 14",
                "FastAPI",
                "PostgreSQL 16",
                "Async SQLAlchemy 2.0",
                "LangGraph",
                "FastMCP (Streamable HTTP)",
                "Docker Compose",
                "Tailwind CSS",
                "Pydantic Settings",
              ].map((tech) => (
                <div key={tech} className="rounded-lg bg-[#F4F7FB] border border-[#DCE3EC] px-3 py-2 text-center text-xs font-medium text-[#0C2340]">
                  {tech}
                </div>
              ))}
            </div>
          </section>

          <section id="api-docs" className="bg-white border border-[#DCE3EC] rounded-xl p-6 sm:p-8 scroll-mt-24">
            <h2 className="text-xl font-bold text-[#0C2340] flex items-center gap-2">
              <FileText size={18} className="text-[#0070E0]" /> API Docs
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">Base: <code className="rounded bg-[#F4F7FB] border border-[#DCE3EC] px-1 font-mono text-xs">http://localhost:8000</code> — JWT Bearer auth required (except <code className="font-mono text-xs">/api/health</code>, <code className="font-mono text-xs">/api/ready</code>, <code className="font-mono text-xs">/metrics</code>, <code className="font-mono text-xs">/api/docs/*</code> public reads).</p>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-lg border border-[#DCE3EC] overflow-hidden">
                <div className="bg-[#0C2340] px-3 py-1.5 text-xs font-mono font-semibold text-white">POST /token</div>
                <div className="p-3 bg-[#F4F7FB] font-mono text-xs">username=&lt;email&gt; &amp; password=&lt;password&gt; (x-www-form-urlencoded) → &#123;&quot;access_token&quot;, role, email&#125;</div>
              </div>
              <div className="rounded-lg border border-[#DCE3EC] overflow-hidden">
                <div className="bg-[#0C2340] px-3 py-1.5 text-xs font-mono font-semibold text-white">GET /api/routes/compare?amount=1000&payout_method=BKASH</div>
                <div className="p-3 bg-[#F4F7FB] font-mono text-xs">Authorization: Bearer &lt;JWT&gt; → ranked routes (deterministic)</div>
              </div>
              <div className="rounded-lg border border-[#DCE3EC] overflow-hidden">
                <div className="bg-[#0C2340] px-3 py-1.5 text-xs font-mono font-semibold text-white">POST /api/agent/execute</div>
                <div className="p-3 bg-[#F4F7FB] font-mono text-xs">Body: amount, payout_method, quote_id, confirmed + Idempotency-Key; RBAC: user/admin only; guest → 403</div>
              </div>
              <div className="rounded-lg border border-[#DCE3EC] overflow-hidden">
                <div className="bg-[#0070E0] px-3 py-1.5 text-xs font-mono font-semibold text-white">GET /api/docs/live-data — NEW</div>
                <div className="p-3 bg-[#E8F1FC] font-mono text-xs">Public → &#123;&quot;total_users&quot;, &quot;total_quotes&quot;, &quot;mcp_status&quot;&#125; from PostgreSQL</div>
              </div>
            </div>
          </section>

          <div className="text-center text-xs text-[#94A3B8] py-4">
            Live docs — PostgreSQL truth (DocsConfig + TeamMember) · MCP read-only · Deterministic Decimal · Docker Compose: db (5432) + backend (8000) + mcp (8001) + frontend (3000)
          </div>
        </main>
      </div>

      {/* Admin floating gear → drawer */}
      {isAdmin && (
        <>
          <button
            onClick={() => setShowAdminDrawer(true)}
            className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[#0C2340] text-white shadow-lg hover:bg-[#33415C]"
            title="Admin settings"
          >
            <Settings size={20} />
          </button>
          {showAdminDrawer && (
            <div className="fixed inset-0 z-40 flex">
              <div className="flex-1 bg-black/30" onClick={() => setShowAdminDrawer(false)} />
              <div className="w-full max-w-[420px] bg-white border-l border-[#DCE3EC] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-[#DCE3EC] flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#0C2340] flex items-center gap-2">
                    <Shield size={16} className="text-[#0070E0]" /> Admin — Live Docs
                  </h2>
                  <button onClick={() => setShowAdminDrawer(false)} className="rounded-lg border border-[#DCE3EC] p-1.5 hover:bg-[#F4F7FB]">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div>
                    <h3 className="text-xs font-semibold tracking-widest text-[#94A3B8] uppercase">Scheduling</h3>
                    <label className="mt-3 flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={editPublic} onChange={(e) => setEditPublic(e.target.checked)} className="rounded border-[#DCE3EC] text-[#0070E0] focus:ring-[#0070E0]" />
                      <span className="font-medium text-[#0C2340]">is_public</span>
                    </label>
                    <label className="mt-3 block text-xs font-medium text-[#0C2340]">
                      Start time
                      <input type="datetime-local" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="mt-1 w-full rounded-lg border border-[#DCE3EC] px-3 py-2 text-sm" />
                    </label>
                    <label className="mt-3 block text-xs font-medium text-[#0C2340]">
                      End time
                      <input type="datetime-local" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-[#DCE3EC] px-3 py-2 text-sm" />
                    </label>
                    <button onClick={handleSaveConfig} disabled={adminSaving} className="mt-3 w-full rounded-lg bg-[#0070E0] py-2.5 text-sm font-semibold text-white hover:bg-[#005FC2] disabled:opacity-40">
                      {adminSaving ? "Saving..." : "Save config"}
                    </button>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold tracking-widest text-[#94A3B8] uppercase">Team — Add</h3>
                    <form onSubmit={handleAddMember} className="mt-3 space-y-3">
                      <input placeholder="Name" value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} required className="w-full rounded-lg border border-[#DCE3EC] px-3 py-2 text-sm" />
                      <input placeholder="Role" value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value })} required className="w-full rounded-lg border border-[#DCE3EC] px-3 py-2 text-sm" />
                      <input placeholder="Email" type="email" value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} required className="w-full rounded-lg border border-[#DCE3EC] px-3 py-2 text-sm" />
                      <input placeholder="Image URL (optional)" value={newMember.image_url} onChange={(e) => setNewMember({ ...newMember, image_url: e.target.value })} className="w-full rounded-lg border border-[#DCE3EC] px-3 py-2 text-sm" />
                      <input placeholder="Order index" type="number" value={newMember.order_index} onChange={(e) => setNewMember({ ...newMember, order_index: parseInt(e.target.value) || 0 })} className="w-full rounded-lg border border-[#DCE3EC] px-3 py-2 text-sm" />
                      <button type="submit" disabled={adminSaving} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0C2340] py-2.5 text-sm font-semibold text-white hover:bg-[#33415C] disabled:opacity-40">
                        <Plus size={14} /> Add member
                      </button>
                    </form>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold tracking-widest text-[#94A3B8] uppercase">Team — Remove</h3>
                    <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                      {team.map((m) => (
                        <div key={m.id} className="flex items-center gap-3 rounded-lg border border-[#DCE3EC] p-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#0C2340] truncate">{m.name}</p>
                            <p className="text-xs text-[#64748B] truncate">{m.role} · {m.email}</p>
                          </div>
                          <button onClick={() => handleDeleteMember(m.id)} className="rounded-lg border border-[#DCE3EC] p-1.5 text-[#B42318] hover:bg-[#FDECEA]">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      {team.length === 0 && <p className="text-xs text-[#64748B]">No members</p>}
                    </div>
                  </div>

                  {adminMsg && (
                    <div className="rounded-lg border border-[#0070E0]/20 bg-[#E8F1FC] px-3 py-2 text-xs text-[#0C2340]">{adminMsg}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
