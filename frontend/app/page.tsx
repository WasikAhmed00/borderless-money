"use client";

import { useEffect, useState } from "react";
import { Shield, Loader2, Settings, Check, ArrowRight, Info, Menu, X, Wallet, Building2, BadgeCheck, Mic } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import MicButton from "@/components/MicButton";
import ChainTrail from "@/components/ChainTrail";
import AgentPipeline from "@/components/AgentPipeline";
import { executeTransfer, fmtBDT, fmtCurrency, getQuote } from "@/lib/api";
import { STRINGS, applyDocLang, savedLang, type Lang } from "@/lib/i18n";
import type { AgentStateResponse, DemoScenario } from "@/lib/types";

type Screen = "send" | "quote" | "review" | "receipt";
type T = (typeof STRINGS)["en"];
const DEMO_CORRIDOR = { sourceCur: "AED", destCur: "BDT" };

const PAYOUT_OPTIONS = (t: T) => [
  { value: "BKASH", label: "bKash", detail: t.payoutWalletInstant, badge: t.payoutBadgeBonus },
  { value: "NAGAD", label: "Nagad", detail: t.payoutWalletPostal, badge: t.payoutBadgeBonus },
  { value: "UPAY", label: "Upay", detail: t.payoutWalletUcb, badge: t.payoutBadgeBonus },
  { value: "DEBIT_CARD", label: t.payoutDebit, detail: t.payoutCardNetworks, badge: t.payoutBadgeDirect },
  { value: "CREDIT_CARD", label: t.payoutCredit, detail: t.payoutCardCredit, badge: t.payoutBadgeDirect },
  { value: "VISA_CARD", label: t.payoutVisa, detail: t.payoutPushToCard, badge: t.payoutBadgeFast },
];
const SCENARIOS = (t: T) => [
  { key: "default" as DemoScenario, label: t.scDefault, desc: t.scDefaultDesc },
  { key: "fuzzy_review" as DemoScenario, label: t.scFuzzy, desc: t.scFuzzyDesc },
  { key: "high_risk" as DemoScenario, label: t.scHigh, desc: t.scHighDesc },
];

function LangToggle({ lang, onLang }: { lang: Lang; onLang: (l: Lang) => void }) {
  return (
    <div className="flex rounded-lg border border-[#DCE3EC] bg-[#F4F7FB] p-1 text-xs font-semibold">
      <button type="button" onClick={() => onLang("en")} className={`rounded-md px-2.5 py-1 transition ${lang === "en" ? "bg-white border border-[#DCE3EC] text-[#0C2340] shadow-sm" : "text-[#64748B] hover:text-[#0C2340]"}`}>EN</button>
      <button type="button" onClick={() => onLang("bn")} className={`rounded-md px-2.5 py-1 transition ${lang === "bn" ? "bg-white border border-[#DCE3EC] text-[#0C2340] shadow-sm" : "text-[#64748B] hover:text-[#0C2340]"}`}>বাং</button>
    </div>
  );
}

function TopBar({ lang, onLang, healthOk, onRetryHealth, scenario, onScenario, active = "send" }: { lang: Lang; onLang: (l: Lang) => void; healthOk: boolean | null; onRetryHealth: () => void; scenario: DemoScenario; onScenario: (s: DemoScenario) => void; active?: string; }) {
  const t = STRINGS[lang];
  const [gearOpen, setGearOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const healthLabel = healthOk === false ? t.healthAsleep : t.healthReady;
  return (
    <header className="sticky top-0 z-30 border-b border-[#DCE3EC] bg-white" style={{ height: 64 }}>
      <div className="xpay-container flex h-full items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center"><BrandMark /></a>
          <nav className="hidden sm:flex items-center gap-6 text-sm">
            <a href="/" className={`pb-1 font-medium transition border-b-2 ${active === "send" ? "border-[#0070E0] text-[#0C2340]" : "border-transparent text-[#64748B] hover:text-[#0C2340]"}`}>{t.navSend}</a>
            <a href="/roi" className={`pb-1 font-medium transition border-b-2 ${active === "roi" ? "border-[#0070E0] text-[#0C2340]" : "border-transparent text-[#64748B] hover:text-[#0C2340]"}`}>{t.navRoi}</a>
          </nav>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <LangToggle lang={lang} onLang={onLang} />
          <span title={healthLabel} className="h-2 w-2 rounded-full shrink-0" style={{ background: healthOk === false ? "#B42318" : healthOk ? "#067647" : "#DCE3EC" }} aria-label={healthLabel} />
          <div className="relative">
            <button type="button" onClick={() => setGearOpen(!gearOpen)} aria-label={t.demoControls} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCE3EC] bg-white text-[#64748B] hover:text-[#0C2340] hover:border-[#C7D2DF]">
              <Settings size={18} strokeWidth={1.75} />
            </button>
            {gearOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-[#DCE3EC] bg-white p-4 shadow-[0_1px_2px_rgba(12,35,64,.06)] z-20">
                <p className="text-sm font-semibold text-[#0C2340] mb-2">{t.demoScenarioShort}</p>
                <div className="space-y-2">
                  {SCENARIOS(t).map(sc => (
                    <label key={sc.key} className="flex items-start gap-2 rounded-lg border border-[#DCE3EC] p-2.5 cursor-pointer hover:border-[#C7D2DF] has-[input:checked]:border-[#0070E0] has-[input:checked]:bg-[#E8F1FC]">
                      <input type="radio" name="scenario" checked={scenario === sc.key} onChange={() => onScenario(sc.key)} className="mt-0.5 accent-[#0070E0]" />
                      <span><span className="text-sm font-medium text-[#0C2340]">{sc.label}</span><span className="block text-xs text-[#64748B]">{sc.desc}</span></span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs text-[#64748B] border-t border-[#DCE3EC] pt-3">{t.simulatedQuotesDisclosure}</p>
                {healthOk === false && <button type="button" onClick={() => onRetryHealth()} className="mt-2 text-xs font-semibold text-[#0070E0] hover:text-[#005FC2]">{t.retry}</button>}
              </div>
            )}
          </div>
        </div>
        <button type="button" className="sm:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-[#DCE3EC] bg-white" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">{menuOpen ? <X size={18} strokeWidth={1.75} /> : <Menu size={18} strokeWidth={1.75} />}</button>
      </div>
      {menuOpen && (
        <div className="sm:hidden border-t border-[#DCE3EC] bg-white xpay-container py-3 space-y-3">
          <nav className="flex flex-col gap-2 text-sm">
            <a href="/" className={`font-medium ${active === "send" ? "text-[#0C2340] border-l-2 border-[#0070E0] pl-2" : "text-[#64748B]"}`}>{t.navSend}</a>
            <a href="/roi" className={`font-medium ${active === "roi" ? "text-[#0C2340] border-l-2 border-[#0070E0] pl-2" : "text-[#64748B]"}`}>{t.navRoi}</a>
          </nav>
          <LangToggle lang={lang} onLang={onLang} />
          <div className="flex items-center gap-2 text-xs text-[#64748B]"><span className="h-2 w-2 rounded-full" style={{ background: healthOk === false ? "#B42318" : healthOk ? "#067647" : "#DCE3EC" }} />{healthLabel}</div>
          <button type="button" onClick={() => setGearOpen(!gearOpen)} className="flex items-center gap-2 text-sm font-medium text-[#0C2340]">{t.demoControls} <Settings size={16} strokeWidth={1.75} /></button>
          {gearOpen && (
            <div className="space-y-2">
              {SCENARIOS(t).map(sc => (<label key={sc.key} className="flex items-center gap-2 text-sm"><input type="radio" checked={scenario === sc.key} onChange={() => onScenario(sc.key)} className="accent-[#0070E0]" />{sc.label}</label>))}
              <p className="text-xs text-[#64748B]">{t.simulatedQuotesDisclosure}</p>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

function Stepper({ current, lang, onNavigate, hasQuote, hasResult }: { current: Screen; lang: Lang; onNavigate: (s: Screen) => void; hasQuote: boolean; hasResult: boolean; }) {
  const t = STRINGS[lang];
  const order: Screen[] = ["send", "quote", "review", "receipt"];
  const idx = order.indexOf(current);
  const labels: Record<Screen, string> = { send: t.progressSend, quote: t.progressCompare, review: t.progressConfirm, receipt: t.progressReceipt };
  const canGo = (s: Screen) => {
    const i = order.indexOf(s);
    if (i <= idx) return true;
    if (s === "quote" && hasQuote) return true;
    if (s === "review" && hasQuote) return true;
    if (s === "receipt" && hasResult) return true;
    return false;
  };
  return (
    <>
      <div className="hidden sm:flex items-center gap-2" aria-label="Progress">
        {order.map((step, i) => {
          const completed = i < idx;
          const isCurrent = i === idx;
          const clickable = canGo(step);
          const dot = (
            <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${isCurrent ? "border-[#0070E0] bg-[#0070E0] text-white" : completed ? "border-[#0070E0] bg-[#E8F1FC] text-[#0070E0]" : "border-[#DCE3EC] bg-white text-[#64748B]"}`} aria-hidden="true">
              {completed ? <Check size={14} strokeWidth={2} /> : i + 1}
            </span>
          );
          return (
            <div key={step} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
                {clickable ? <button type="button" onClick={() => onNavigate(step)} className="flex items-center gap-2 rounded-full focus-visible:outline-none" aria-current={isCurrent ? "step" : undefined}>{dot}<span className={`text-sm font-medium ${isCurrent ? "text-[#0C2340]" : completed ? "text-[#0C2340]" : "text-[#64748B]"}`}>{labels[step]}</span></button> : <span className="flex items-center gap-2">{dot}<span className="text-sm font-medium text-[#64748B]">{labels[step]}</span></span>}
              </div>
              {i < order.length - 1 && <span className={`h-px flex-1 ${i < idx ? "bg-[#0070E0]" : "bg-[#DCE3EC]"}`} aria-hidden="true" />}
            </div>
          );
        })}
      </div>
      <div className="sm:hidden text-sm text-[#64748B]">{t.stepOf(idx + 1, 4, labels[current])}</div>
    </>
  );
}

function FeatureRow({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E8F1FC] text-[#0070E0]"><Icon size={16} strokeWidth={1.75} /></span>
      <span><span className="block text-[15px] font-semibold text-[#0C2340]">{title}</span><span className="block text-[13px] text-[#64748B]">{desc}</span></span>
    </div>
  );
}

function Footer({ lang }: { lang: Lang }) {
  const t = STRINGS[lang];
  return <footer className="border-t border-[#DCE3EC] bg-white"><div className="xpay-container py-4 text-center text-xs text-[#64748B]">{t.honestyFooter}</div></footer>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("send");
  const [lang, setLang] = useState<Lang>("en");
  const [amount, setAmount] = useState("1,000");
  const [recipient, setRecipient] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("BKASH");
  const [deadline, setDeadline] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [scenario, setScenario] = useState<DemoScenario>("default");
  const [quote, setQuote] = useState<AgentStateResponse | null>(null);
  const [result, setResult] = useState<AgentStateResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [waking, setWaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const t = STRINGS[lang];
  const checkHealth = () => { fetch(`${process.env.NEXT_PUBLIC_API_BASE || ""}/api/health`).then(r => r.ok ? r.json() : Promise.reject()).then(() => setHealthOk(true)).catch(() => setHealthOk(false)); };
  useEffect(() => { const l = savedLang(); setLang(l); applyDocLang(l); const s = new URLSearchParams(window.location.search).get("scenario"); if (s === "fuzzy_review" || s === "fuzzy") setScenario("fuzzy_review"); else if (s === "high_risk") setScenario("high_risk"); checkHealth(); }, []);
  const switchLang = (l: Lang) => { setLang(l); window.localStorage.setItem("xpay-lang", l); applyDocLang(l); };
  const amountValue = Number(amount.replace(/,/g, ""));
  const reset = () => { setQuote(null); setResult(null); setTranscript(null); setError(null); setScreen("send"); };
  const navigate = (s: Screen) => { if (s === "send") setScreen("send"); else if (s === "quote" && quote) setScreen("quote"); else if (s === "review" && quote) setScreen("review"); else if (s === "receipt" && result) setScreen("receipt"); };
  const getBestRate = async () => {
    setBusy(true); setWaking(false); setError(null); setResult(null);
    try { const state = await getQuote({ amount: amountValue, recipient_name: recipient.trim() || undefined, payout_method: payoutMethod, deadline_hours: deadline ? Number(deadline) : undefined, demo_scenario: scenario }, () => setWaking(true)); if (!state.routes.length) throw new Error(t.noRoutes); setQuote(state); setScreen("quote"); } catch (e) { setError(e instanceof Error ? (e.message === "API_UNREACHABLE" ? t.apiDown : e.message) : t.rateError); } finally { setBusy(false); setWaking(false); }
  };
  const send = async (routeName: string) => {
    setBusy(true); setWaking(false); setError(null);
    try { const state = await executeTransfer({ amount: amountValue, recipient_name: recipient.trim() || undefined, payout_method: payoutMethod, selected_route_name: routeName, demo_scenario: scenario, quote_id: quote?.quote_id ?? undefined, confirmed: Boolean(quote?.quote_id) }, () => setWaking(true)); setResult(state); if (state.error === "quote_expired" || state.error === "quote_already_used") { setError(t.quoteExpiredMsg); setScreen("send"); return; } if (state.decision === "CLEAR") setScreen("receipt"); else if (state.decision === "BLOCKED") setError(t.blocked); else setScreen("review"); } catch (e) { setError(e instanceof Error ? (e.message === "API_UNREACHABLE" ? t.apiDown : e.message) : t.sendError); } finally { setBusy(false); setWaking(false); }
  };

  if (screen === "quote" && quote) return <QuoteScreen quote={quote} lang={lang} onLang={switchLang} healthOk={healthOk} onRetryHealth={checkHealth} busy={busy} waking={waking} error={error} onSend={send} onBack={() => setScreen("send")} scenario={scenario} onScenario={setScenario} hasResult={!!result} onNavigate={navigate} />;
  if (screen === "review") return <ReviewScreen lang={lang} onLang={switchLang} healthOk={healthOk} onRetryHealth={checkHealth} onDone={reset} scenario={scenario} onScenario={setScenario} hasQuote={!!quote} hasResult={!!result} onNavigate={navigate} />;
  if (screen === "receipt" && result) return <ReceiptScreen result={result} lang={lang} onLang={switchLang} healthOk={healthOk} onRetryHealth={checkHealth} arrivalHours={quote?.routes.find(r => r.name === result.transaction?.route_selected)?.settlement_time_hrs} onRestart={reset} scenario={scenario} onScenario={setScenario} hasQuote={!!quote} hasResult={!!result} onNavigate={navigate} />;

  return (
    <div className="xpay-shell min-h-screen flex flex-col">
      <TopBar lang={lang} onLang={switchLang} healthOk={healthOk} onRetryHealth={checkHealth} scenario={scenario} onScenario={setScenario} active="send" />
      <main className="flex-1 xpay-container flex min-h-[calc(100vh-64px)] items-center py-8">
        <div className="grid w-full gap-12 lg:grid-cols-[1.05fr_0.95fr] items-start">
          <div className="order-2 lg:order-1 pt-2">
            <p className="text-sm text-[#64748B]">{t.sendMoneyTitle}</p>
            <h1 className="mt-2 text-[32px] sm:text-[40px] font-bold leading-tight tracking-tight text-[#0C2340]">{t.sendMoneySubtitle}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#33415C]">{t.landingIntroBody}</p>
            <div className="mt-8 space-y-4">
              <FeatureRow icon={Wallet} title={t.featureTrueNetTitle} desc={t.featureTrueNetDesc} />
              <FeatureRow icon={Building2} title={t.featureRailsTitle} desc={t.featureRailsDesc} />
              <FeatureRow icon={BadgeCheck} title={t.featureScreeningTitle} desc={t.featureScreeningDesc} />
              <FeatureRow icon={Mic} title={t.featureVoiceTitle} desc={t.featureVoiceDesc} />
            </div>
            <p className="mt-8 text-xs text-[#94A3B8]">{t.landingFootnote}</p>
          </div>
          <div className="order-1 lg:order-2">
            <div className="xpay-card p-6 sm:p-7">
              <div className="mb-4"><Stepper current="send" lang={lang} onNavigate={navigate} hasQuote={!!quote} hasResult={!!result} /></div>
              <form onSubmit={(e) => { e.preventDefault(); if (Number.isFinite(amountValue) && amountValue > 0 && !busy) getBestRate(); }} className="space-y-6">
                <div>
                  <label htmlFor="amount" className="mb-2 block text-sm font-medium text-[#0C2340]">{t.youSendLabel}</label>
                  <div className="flex items-center gap-3 rounded-lg border border-[#DCE3EC] bg-white px-4 py-1 focus-within:border-[#0070E0] focus-within:ring-2 focus-within:ring-[#0070E0]/20">
                    <input id="amount" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} className="min-w-0 flex-1 bg-transparent text-right text-[40px] font-semibold tracking-tight text-[#0C2340] outline-none xpay-mono" />
                    <span className="text-sm font-medium text-[#64748B]">{DEMO_CORRIDOR.sourceCur}</span>
                    <MicButton onTranscript={(text) => { setTranscript(text); const m = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/); if (m) setAmount(m[1]); }} disabled={busy} titleMic={t.micTitle} titleListening={t.micListening} titleUnsupported={t.micUnsupported} />
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {["500", "1,000", "2,500", "5,000"].map(val => (
                      <button key={val} type="button" onClick={() => setAmount(val)} className={`rounded-lg border py-2 text-sm font-medium transition ${amount === val ? "border-[#0070E0] bg-[#E8F1FC] text-[#0C2340]" : "border-[#DCE3EC] bg-white text-[#0C2340] hover:border-[#C7D2DF]"}`}>{val}</button>
                    ))}
                  </div>
                  {transcript && <p className="mt-2 text-[13px] text-[#64748B]">{t.heard}: “{transcript}”</p>}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-[#0C2340]">{t.recipientChannel}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PAYOUT_OPTIONS(t).map(opt => {
                      const selected = payoutMethod === opt.value;
                      return (
                        <button key={opt.value} type="button" onClick={() => setPayoutMethod(opt.value)} aria-pressed={selected} className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left transition ${selected ? "border-[#0070E0] bg-[#E8F1FC]" : "border-[#DCE3EC] bg-white hover:border-[#C7D2DF]"}`}>
                          <span className="min-w-0">
                            <span className="text-sm font-semibold text-[#0C2340]">{opt.label}</span>
                            <span className="block text-[13px] text-[#64748B] truncate">{opt.detail}</span>
                          </span>
                          <span className="flex items-center gap-2 shrink-0 ml-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${opt.badge === t.payoutBadgeBonus ? "bg-[#FFF4E0] text-[#B45309] border-[#F59E0B]/30" : "bg-[#F4F7FB] text-[#64748B] border-[#DCE3EC]"}`}>{opt.badge}</span>
                            <span className={`h-4 w-4 rounded-full border flex items-center justify-center ${selected ? "border-[#0070E0] bg-white" : "border-[#DCE3EC] bg-white"}`}>{selected && <span className="h-2 w-2 rounded-full bg-[#0070E0]" />}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-[#0C2340]">{t.arriveBy}</p>
                  <div className="flex flex-wrap gap-2">
                    {[{ v: "", label: t.arrivalAny }, { v: "3", label: t.arrival3h }, { v: "12", label: t.arrival12h }, { v: "24", label: t.arrival24h }].map(opt => (
                      <button key={opt.v} type="button" onClick={() => setDeadline(opt.v)} className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${deadline === opt.v ? "border-[#0070E0] bg-[#E8F1FC] text-[#0C2340]" : "border-[#DCE3EC] bg-white text-[#64748B] hover:border-[#C7D2DF]"}`}>{opt.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="recipient" className="mb-2 block text-sm font-medium text-[#0C2340]">{t.recipientOptional}</label>
                  <input id="recipient" autoComplete="off" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={t.recipientNamePlaceholder} className="w-full rounded-lg border border-[#DCE3EC] bg-white px-4 py-3 text-sm text-[#0C2340] placeholder:text-[#94A3B8] focus:border-[#0070E0] focus:ring-2 focus:ring-[#0070E0]/20 outline-none" />
                </div>
                {error && <div className="flex items-center justify-between gap-3 rounded-lg border border-[#B42318]/20 bg-[#FDECEA] p-3 text-sm text-[#B42318]"><span>{error}</span><button type="button" onClick={() => getBestRate()} className="shrink-0 rounded-lg border border-[#B42318]/20 bg-white px-3 py-1 text-xs font-semibold hover:bg-[#F4F7FB]">{t.retry}</button></div>}
                <button type="submit" disabled={!Number.isFinite(amountValue) || amountValue <= 0 || busy} className="hidden sm:flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0070E0] text-sm font-semibold text-white hover:bg-[#005FC2] active:bg-[#00429A] disabled:opacity-40">{busy ? <span className="flex items-center gap-2"><Loader2 size={16} strokeWidth={1.75} className="animate-spin" />{waking ? t.wakingUp : t.evaluating}</span> : <><span>{t.bestRateBtn}</span><ArrowRight size={16} strokeWidth={1.75} /></>}</button>
                <p className="flex items-start gap-2 text-[13px] leading-relaxed text-[#64748B]"><Info size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#64748B]" />{t.trustStrip}</p>
              </form>
            </div>
            <div className="sm:hidden sticky bottom-0 mt-4 border-t border-[#DCE3EC] bg-white p-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
              <button type="button" disabled={!Number.isFinite(amountValue) || amountValue <= 0 || busy} onClick={() => getBestRate()} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0070E0] text-sm font-semibold text-white disabled:opacity-40">{busy && <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />}{busy ? (waking ? t.wakingUp : t.evaluating) : t.bestRateBtn}</button>
            </div>
          </div>
        </div>
      </main>
      <Footer lang={lang} />
    </div>
  );
}

function QuoteScreen({ quote, lang, onLang, healthOk, onRetryHealth, busy, waking, error, onSend, onBack, scenario, onScenario, hasResult, onNavigate }: { quote: AgentStateResponse; lang: Lang; onLang: (l: Lang) => void; healthOk: boolean | null; onRetryHealth: () => void; busy: boolean; waking: boolean; error: string | null; onSend: (r: string) => void; onBack: () => void; scenario: DemoScenario; onScenario: (s: DemoScenario) => void; hasResult: boolean; onNavigate: (s: Screen) => void; }) {
  const t = STRINGS[lang];
  const bestPossible = quote.routes.find(r => r.is_best) ?? quote.routes.find(r => r.pricing_completeness === "complete" && r.breakdown.true_net_receive_bdt != null) ?? quote.routes[0];
  const [selectedName, setSelectedName] = useState(bestPossible.name);
  const selected = quote.routes.find(r => r.name === selectedName) ?? bestPossible;
  const marketValue = (selected.breakdown.amount_source ?? 0) * selected.mid_market_rate;
  const grossBdt = selected.breakdown.gross_bdt ?? marketValue;
  const spreadCostVal = marketValue - grossBdt;
  const incentiveVal = selected.breakdown.govt_incentive_added_bdt ?? 0;
  const netVsMid = (selected.breakdown.true_net_receive_bdt ?? 0) - marketValue;
  const forfeitRate = quote.routes.find(r => r.incentive_eligible && (r.breakdown.govt_incentive_rate ?? 0) > 0)?.breakdown.govt_incentive_rate ?? null;
  const whyBody = selected.is_best ? t.whyBestBody(selected.rail) : t.whyWorseBody(selected.rail, Math.abs(selected.advantage_bdt_vs_best ?? 0));
  return (
    <div className="xpay-shell min-h-screen flex flex-col">
      <TopBar lang={lang} onLang={onLang} healthOk={healthOk} onRetryHealth={onRetryHealth} scenario={scenario} onScenario={onScenario} active="send" />
      <main className="flex-1 xpay-container py-6">
        <button onClick={onBack} className="text-sm font-medium text-[#0070E0] hover:text-[#005FC2]">{t.changeLabel}</button>
        <div className="mt-4"><Stepper current="quote" lang={lang} onNavigate={onNavigate} hasQuote={true} hasResult={hasResult} /></div>
        <div className="xpay-card mt-6 p-6 sm:p-8 xpay-fade-up">
          <p className="text-sm text-[#64748B]">{t.recipientReceives}</p>
          <p className="mt-1 text-[48px] sm:text-[56px] font-semibold leading-none tracking-tight text-[#0C2340] xpay-mono">{fmtBDT(selected.breakdown.true_net_receive_bdt)}</p>
          {selected.breakdown.govt_incentive_added_bdt != null && <p className="mt-2 text-sm text-[#64748B]"><span className="bg-[#FFF4E0] px-1.5 py-0.5 rounded text-[#B45309]">{t.includesBonus(fmtBDT(selected.breakdown.govt_incentive_added_bdt))}</span><span className="ml-2">· via {selected.rail} → {selected.payout_method}</span></p>}
          <div className="mt-2 flex justify-end"><span className="text-xs text-[#94A3B8]">{t.quoteIdLabel}: {quote.quote_id?.slice(0, 10)}… · {t.quoteExpires}</span></div>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-3">
            <div className="flex items-baseline justify-between"><h2 className="text-[20px] font-bold text-[#0C2340]">{t.compareAllRoutes}</h2><span className="text-xs text-[#64748B]">{t.optionsEvaluated(quote.routes.length)}</span></div>
            <p className="text-xs text-[#64748B]">{t.rankedBy}</p>
            <div className="space-y-2">
              {quote.routes.map((route, index) => {
                const forfeited = route.incentive_eligible || route.breakdown.gross_bdt == null || !(forfeitRate && forfeitRate > 0) ? null : route.breakdown.gross_bdt * forfeitRate;
                const isSelected = route.name === selected.name; const isBest = route.is_best;
                return (
                  <button key={route.name} type="button" onClick={() => setSelectedName(route.name)} aria-checked={isSelected} role="radio" className={`w-full rounded-xl border bg-white p-4 text-left transition ${isSelected ? "border-[#0070E0] bg-[#E8F1FC]" : isBest ? "border-[#0070E0]" : "border-[#DCE3EC] hover:border-[#C7D2DF]"}`}>
                    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold shrink-0 ${isSelected ? "border-[#0070E0] bg-[#0070E0] text-white" : isBest ? "border-[#0070E0] bg-[#E8F1FC] text-[#0070E0]" : "border-[#DCE3EC] bg-white text-[#64748B]"}`}>{index + 1}</span>
                      <span className="min-w-0"><span className="flex items-center gap-2"><span className="text-sm font-semibold text-[#0C2340]">{route.rail}</span>{isBest && <span className="rounded-full bg-[#E8F1FC] border border-[#0070E0]/30 px-2 py-0.5 text-xs font-semibold text-[#0070E0]">{t.recommended}</span>}</span><span className="block text-[13px] text-[#64748B] truncate">{route.payout_method} · {route.incentive_eligible ? t.incentiveEligible : t.noIncentive} · {t.hoursArrival(route.settlement_time_hrs)} · {t.feeTag(fmtCurrency(route.fee_total_source, DEMO_CORRIDOR.sourceCur))}</span>{forfeited && forfeited > 0.5 && !route.incentive_eligible && <span className="block text-xs text-[#B42318]">{t.forfeitsBonus(fmtBDT(forfeited))}</span>}</span>
                      <span className="text-[18px] font-semibold text-[#0C2340] xpay-mono text-right">{fmtBDT(route.breakdown.true_net_receive_bdt)}</span>
                      <span className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? "border-[#0070E0] bg-white" : "border-[#DCE3EC] bg-white"}`}>{isSelected && <span className="h-2 w-2 rounded-full bg-[#0070E0]" />}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
          <aside className="space-y-4 lg:sticky lg:top-24 self-start">
            <div className="xpay-card p-5">
              <p className="text-sm font-semibold text-[#0C2340]">{t.whyThisRouteTitle}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#33415C]">{whyBody}</p>
              <div className="mt-4 space-y-0 divide-y divide-[#DCE3EC] border-t border-[#DCE3EC] text-[13px]">
                <Row label={t.amountSent} value={fmtCurrency(selected.breakdown.amount_source, DEMO_CORRIDOR.sourceCur)} />
                <Row label={t.fxRateLabel} value={t.fxRate(selected.fx_rate.toFixed(2))} />
                <Row label={t.fxMidLabel} value={`1 ${DEMO_CORRIDOR.sourceCur} = ${selected.mid_market_rate.toFixed(2)} BDT`} />
                <Row label={t.routeFee} value={fmtCurrency(selected.fee_total_source, DEMO_CORRIDOR.sourceCur)} />
                {(selected.platform_fee_source ?? 0) > 0 && <Row label={t.ofWhichXpay} value={fmtCurrency(selected.platform_fee_source, DEMO_CORRIDOR.sourceCur)} />}
                <Row label={t.arrivalLabel} value={t.arrivalHours(selected.settlement_time_hrs)} />
                <div className="py-2 space-y-1">
                  <Row label={t.spreadCost(fmtBDT(spreadCostVal))} value={fmtBDT(spreadCostVal)} danger={spreadCostVal > 0} />
                  <Row label={t.incentiveGain(fmtBDT(incentiveVal))} value={fmtBDT(incentiveVal)} success={incentiveVal > 0} />
                  <Row label={t.netVsMidMarket} value={`${netVsMid >= 0 ? "+" : "−"}${fmtBDT(Math.abs(netVsMid))}`} success={netVsMid > 0} danger={netVsMid < 0} strong />
                </div>
              </div>
            </div>
            <AgentPipeline quote={quote} busy={busy} t={t} />
            {quote.decision === "CLEAR" ? <div className="rounded-xl border border-[#067647]/20 bg-[#E7F6EE] p-4"><p className="flex items-center gap-2 text-sm font-semibold text-[#067647]"><Shield size={16} strokeWidth={1.75} />{t.complianceCleared}</p><p className="mt-1 text-sm leading-relaxed text-[#0C2340]">{t.complianceClearedBody}</p></div> : quote.decision === "BLOCKED" ? <div className="rounded-xl border border-[#B42318]/20 bg-[#FDECEA] p-4"><p className="flex items-center gap-2 text-sm font-semibold text-[#B42318]"><Shield size={16} strokeWidth={1.75} />{t.blocked}</p><p className="mt-1 text-sm leading-relaxed text-[#0C2340]">{t.holdBody}</p></div> : <div className="rounded-xl border border-[#B45309]/20 bg-[#FDF1E3] p-4"><p className="flex items-center gap-2 text-sm font-semibold text-[#B45309]"><Shield size={16} strokeWidth={1.75} />{quote.decision === "FUZZY_MATCH_REVIEW" ? t.complianceHoldTitle : t.complianceReviewTitle}</p><p className="mt-1 text-sm leading-relaxed text-[#0C2340]">{quote.decision === "FUZZY_MATCH_REVIEW" ? t.holdBody : t.reviewBody}</p></div>}
            {error && <p className="rounded-xl border border-[#B42318]/20 bg-[#FDECEA] p-3 text-sm text-[#B42318]">{error}</p>}
            <button onClick={() => onSend(selected.name)} disabled={busy} className="hidden sm:flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0070E0] text-sm font-semibold text-white hover:bg-[#005FC2] active:bg-[#00429A] disabled:opacity-40">{busy ? (waking ? t.wakingUp : t.sending) : t.sendWith(selected.rail)}{!busy && <ArrowRight size={16} strokeWidth={1.75} />}{busy && <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />}</button>
            <p className="hidden sm:block text-center text-xs text-[#64748B]">{t.confirmExactQuote}</p>
          </aside>
        </div>
      </main>
      <div className="sm:hidden sticky bottom-0 border-t border-[#DCE3EC] bg-white p-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
        <button onClick={() => onSend(selected.name)} disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0070E0] text-sm font-semibold text-white disabled:opacity-40">{busy && <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />}{busy ? (waking ? t.wakingUp : t.sending) : t.sendWith(selected.rail)}</button>
        <p className="mt-2 text-center text-xs text-[#64748B]">{t.confirmExactQuote}</p>
      </div>
      <Footer lang={lang} />
    </div>
  );
}

function Row({ label, value, success, danger, strong }: { label: string; value: string; success?: boolean; danger?: boolean; strong?: boolean; }) {
  return <div className="flex items-baseline justify-between gap-4 py-2"><span className={`text-[#64748B] ${strong ? "font-semibold text-[#0C2340]" : ""}`}>{label}</span><span className={`xpay-mono text-right ${strong ? "font-bold" : "font-semibold"} ${success ? "text-[#067647]" : danger ? "text-[#B42318]" : "text-[#0C2340]"}`}>{value}</span></div>;
}

function ReviewScreen({ lang, onLang, healthOk, onRetryHealth, onDone, scenario, onScenario, hasQuote, hasResult, onNavigate }: { lang: Lang; onLang: (l: Lang) => void; healthOk: boolean | null; onRetryHealth: () => void; onDone: () => void; scenario: DemoScenario; onScenario: (s: DemoScenario) => void; hasQuote: boolean; hasResult: boolean; onNavigate: (s: Screen) => void; }) {
  const t = STRINGS[lang];
  return (
    <div className="xpay-shell min-h-screen flex flex-col">
      <TopBar lang={lang} onLang={onLang} healthOk={healthOk} onRetryHealth={onRetryHealth} scenario={scenario} onScenario={onScenario} active="send" />
      <main className="flex-1 xpay-container py-12">
        <button onClick={() => onNavigate("quote")} className="text-sm font-medium text-[#0070E0] hover:text-[#005FC2]">{t.changeLabel}</button>
        <div className="mt-4"><Stepper current="review" lang={lang} onNavigate={onNavigate} hasQuote={hasQuote} hasResult={hasResult} /></div>
        <div className="mx-auto mt-8 max-w-[480px] xpay-card p-8 text-center xpay-fade-up">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#0070E0]/20 bg-[#E8F1FC] text-[#0070E0]"><Shield size={28} strokeWidth={1.75} /></div>
          <h1 className="mt-4 text-[20px] font-bold tracking-tight text-[#0C2340]">{t.reviewPauseTitle}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#64748B]">{t.reviewSentence} {t.reviewSafeNote}</p>
          <button onClick={onDone} className="mt-6 rounded-lg bg-[#0070E0] px-6 py-3 text-sm font-semibold text-white hover:bg-[#005FC2] active:bg-[#00429A]">{t.gotIt}</button>
        </div>
      </main>
      <Footer lang={lang} />
    </div>
  );
}

function ReceiptScreen({ result, lang, onLang, healthOk, onRetryHealth, arrivalHours, onRestart, scenario, onScenario, hasQuote, hasResult, onNavigate }: { result: AgentStateResponse; lang: Lang; onLang: (l: Lang) => void; healthOk: boolean | null; onRetryHealth: () => void; arrivalHours?: number; onRestart: () => void; scenario: DemoScenario; onScenario: (s: DemoScenario) => void; hasQuote: boolean; hasResult: boolean; onNavigate: (s: Screen) => void; }) {
  const t = STRINGS[lang]; const tx = result.transaction; if (!tx) return null; const execution = result.execution;
  const handleDownload = () => { const blob = new Blob([JSON.stringify(tx, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `xpay-receipt-${tx.transaction_id}.json`; a.click(); URL.revokeObjectURL(url); };
  return (
    <div className="xpay-shell min-h-screen flex flex-col">
      <TopBar lang={lang} onLang={onLang} healthOk={healthOk} onRetryHealth={onRetryHealth} scenario={scenario} onScenario={onScenario} active="send" />
      <main className="flex-1 xpay-container py-8">
        <button onClick={() => onNavigate("quote")} className="text-sm font-medium text-[#0070E0] hover:text-[#005FC2]">{t.changeLabel}</button>
        <div className="mt-4"><Stepper current="receipt" lang={lang} onNavigate={onNavigate} hasQuote={hasQuote} hasResult={hasResult} /></div>
        <div className="mx-auto mt-6 max-w-[640px] xpay-card overflow-hidden xpay-fade-up">
          <div className="bg-[#F4F7FB] p-6 sm:p-8 border-b border-[#DCE3EC]">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#067647] text-white"><Check size={20} strokeWidth={2} /></span>
              <span className="text-[20px] font-bold text-[#0C2340]">{t.sent}</span>
              <span className="ml-auto"><BrandMark /></span>
            </div>
            <p className="mt-4 text-sm text-[#64748B]">{t.recipientReceives}</p>
            <p className="text-[40px] font-semibold leading-none tracking-tight text-[#0C2340] xpay-mono">{fmtBDT(tx.true_net_receive_bdt)}</p>
            <p className="mt-2 text-sm text-[#64748B]">{t.arrivingVia(arrivalHours ?? 2, tx.route_selected ?? "—")}</p>
          </div>
          <div className="p-6 sm:p-8 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow lang={lang} label={t.amountRow} value={fmtCurrency(tx.amount_source, DEMO_CORRIDOR.sourceCur)} />
              <DetailRow lang={lang} label={t.recipientLabel} value={`${tx.recipient_name} (${tx.recipient_handle})`} />
              <DetailRow lang={lang} label={t.routeRow} value={tx.route_selected ?? "—"} />
              <DetailRow lang={lang} label={t.referenceRow} value={tx.transaction_id} mono copyable />
              <DetailRow lang={lang} label={t.arrivesRow} value={t.inAboutHours(arrivalHours ?? 2)} />
              <DetailRow lang={lang} label={t.trackStatusNext} value={t.sent} />
            </div>
            {tx.stellar_hash && <ChainTrail hash={tx.stellar_hash} network={execution?.network ?? "SIMULATED"} labels={{ title: t.simulatedTrailLabel, prev: t.blockPrev, yours: t.blockYours, next: t.blockNext, copyHash: t.ctCopyHash, copied: t.ctCopied }} />}
            <AgentPipeline quote={result} t={t} />
            <details className="rounded-xl border border-[#DCE3EC] bg-[#F4F7FB] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[#0C2340]">{t.technicalDetails} {t.payloadSuffix}</summary>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-white border border-[#DCE3EC] p-4 text-xs font-mono text-[#0C2340] leading-relaxed">{JSON.stringify(tx.iso_20022, null, 2)}</pre>
            </details>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleDownload} className="flex-1 h-12 rounded-lg border border-[#DCE3EC] bg-white text-sm font-semibold text-[#0C2340] hover:border-[#C7D2DF]">{t.downloadJson}</button>
              <button onClick={onRestart} className="flex-1 h-12 rounded-lg bg-[#0070E0] text-sm font-semibold text-white hover:bg-[#005FC2]">{t.sendAnother}</button>
            </div>
          </div>
        </div>
      </main>
      <Footer lang={lang} />
    </div>
  );
}

function DetailRow({ label, value, mono, copyable, lang }: { label: string; value: string; mono?: boolean; copyable?: boolean; lang?: Lang; }) {
  const t = STRINGS[lang ?? savedLang()];
  const [copied, setCopied] = useState(false);
  const onCopy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="rounded-lg border border-[#DCE3EC] bg-[#F4F7FB] px-4 py-3">
      <p className="text-xs text-[#64748B]">{label}</p>
      <p className={`mt-1 flex items-center gap-2 text-sm font-semibold text-[#0C2340] ${mono ? "font-mono text-xs break-all" : ""}`}>{value}{copyable && <button type="button" onClick={onCopy} className="ml-auto text-xs font-medium text-[#0070E0] hover:text-[#005FC2]">{copied ? t.copiedLabel : t.copyLabel}</button>}</p>
    </div>
  );
}
