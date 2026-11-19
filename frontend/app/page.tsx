"use client";

import { useEffect, useState } from "react";
import { Shield, Loader2, Settings, Check, ArrowRight, Clock, ChevronDown } from "lucide-react";
import MicButton from "@/components/MicButton";
import ChainTrail from "@/components/ChainTrail";
import AgentPipeline from "@/components/AgentPipeline";
import { executeTransfer, fmtBDT, fmtCurrency, getQuote } from "@/lib/api";
import { STRINGS, applyDocLang, savedLang, type Lang } from "@/lib/i18n";
import type { AgentStateResponse, DemoScenario, RouteOption } from "@/lib/types";

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
    <div className="flex rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] p-1 text-xs font-semibold">
      <button
        type="button"
        onClick={() => onLang("en")}
        className={`rounded-lg px-2.5 py-1 transition ${lang === "en" ? "bg-[#1A1A18] text-white" : "text-[#6B6B66] hover:text-[#1A1A18]"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => onLang("bn")}
        className={`rounded-lg px-2.5 py-1 transition ${lang === "bn" ? "bg-[#1A1A18] text-white" : "text-[#6B6B66] hover:text-[#1A1A18]"}`}
      >
        বাং
      </button>
    </div>
  );
}

function TopBar({
  lang,
  onLang,
  healthOk,
  onRetryHealth,
  active = "send",
}: {
  lang: Lang;
  onLang: (l: Lang) => void;
  healthOk: boolean | null;
  onRetryHealth: () => void;
  active?: string;
}) {
  const t = STRINGS[lang];
  const healthLabel = healthOk === false ? t.healthAsleep : t.healthReady;
  return (
    <header className="sticky top-0 z-30 border-b border-[#E7E5E0] bg-white">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/assets/xpay-logo.png" alt="xPay" width={28} height={28} className="h-7 w-7 rounded-md object-contain" />
            <span className="text-sm font-bold tracking-tight text-[#1A1A18]">
              x<span className="text-[#D97706]">Pay</span>
            </span>
          </a>
          <nav className="hidden sm:flex items-center gap-1 text-sm">
            <a
              href="/"
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${active === "send" ? "bg-[#1A1A18] text-white" : "text-[#6B6B66] hover:text-[#1A1A18]"}`}
            >
              {t.navSend}
            </a>
            <a
              href="/roi"
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${active === "roi" ? "bg-[#1A1A18] text-white" : "text-[#6B6B66] hover:text-[#1A1A18]"}`}
            >
              {t.navRoi}
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[#E7E5E0] bg-[#FAFAF8] px-3 py-1 text-xs font-medium text-[#6B6B66]">
            {t.topbarCorridor}
          </span>
          <span
            title={healthLabel}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E5E0] bg-white px-2.5 py-1 text-xs"
          >
            <span className={`h-2 w-2 rounded-full ${healthOk === false ? "bg-[#B45309]" : healthOk ? "bg-[#047857]" : "bg-[#E7E5E0]"}`} />
            <span className="hidden sm:inline text-[#6B6B66]">{healthLabel}</span>
            {healthOk === false && (
              <button type="button" onClick={onRetryHealth} className="ml-1 text-xs font-semibold text-[#D97706] hover:text-[#B45309]">
                {t.retry}
              </button>
            )}
          </span>
          <LangToggle lang={lang} onLang={onLang} />
        </div>
      </div>
      <div className="sm:hidden border-t border-[#E7E5E0] flex">
        <a href="/" className={`flex-1 py-2 text-center text-sm font-semibold ${active === "send" ? "bg-[#FAFAF8] text-[#1A1A18]" : "text-[#6B6B66]"}`}>{t.navSend}</a>
        <a href="/roi" className={`flex-1 py-2 text-center text-sm font-semibold border-l border-[#E7E5E0] ${active === "roi" ? "bg-[#FAFAF8] text-[#1A1A18]" : "text-[#6B6B66]"}`}>{t.navRoi}</a>
      </div>
    </header>
  );
}

function ProgressRail({ current, lang }: { current: Screen; lang: Lang }) {
  const order: Screen[] = ["send", "quote", "review", "receipt"];
  const idx = order.indexOf(current);
  const t = STRINGS[lang];
  const labels: Record<Screen, string> = {
    send: t.progressSend,
    quote: t.progressCompare,
    review: t.progressConfirm,
    receipt: t.progressReceipt,
  };
  return (
    <div className="flex items-center gap-2">
      {order.map((step, i) => {
        const active = i <= idx;
        const isCurrent = i === idx;
        return (
          <div key={step} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                  isCurrent ? "border-[#D97706] bg-[#D97706] text-white" : active ? "border-[#1A1A18] bg-[#1A1A18] text-white" : "border-[#E7E5E0] bg-white text-[#6B6B66]"
                }`}
              >
                {i + 1}
              </span>
              <span className={`hidden sm:inline text-xs font-semibold ${isCurrent ? "text-[#1A1A18]" : active ? "text-[#1A1A18]" : "text-[#6B6B66]"}`}>
                {labels[step]}
              </span>
            </div>
            {i < order.length - 1 && <span className={`h-px flex-1 ${i < idx ? "bg-[#1A1A18]" : "bg-[#E7E5E0]"}`} aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

function Footer({ lang }: { lang: Lang }) {
  const t = STRINGS[lang];
  return (
    <footer className="border-t border-[#E7E5E0] bg-white px-5 py-4 text-center text-xs text-[#6B6B66] sm:px-8">
      {t.honestyFooter}
    </footer>
  );
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
  const [showDemoControls, setShowDemoControls] = useState(false);

  const t = STRINGS[lang];

  const checkHealth = () => {
    fetch(`${process.env.NEXT_PUBLIC_API_BASE || ""}/api/health`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(() => setHealthOk(true))
      .catch(() => setHealthOk(false));
  };

  useEffect(() => {
    const l = savedLang();
    setLang(l);
    applyDocLang(l);
    const s = new URLSearchParams(window.location.search).get("scenario");
    if (s === "fuzzy_review" || s === "fuzzy") setScenario("fuzzy_review");
    else if (s === "high_risk") setScenario("high_risk");
    checkHealth();
  }, []);

  const switchLang = (l: Lang) => {
    setLang(l);
    window.localStorage.setItem("xpay-lang", l);
    applyDocLang(l);
  };

  const amountValue = Number(amount.replace(/,/g, ""));

  const reset = () => {
    setQuote(null);
    setResult(null);
    setTranscript(null);
    setError(null);
    setScreen("send");
  };

  const getBestRate = async () => {
    setBusy(true);
    setWaking(false);
    setError(null);
    setResult(null);
    try {
      const state = await getQuote(
        {
          amount: amountValue,
          recipient_name: recipient.trim() || undefined,
          payout_method: payoutMethod,
          deadline_hours: deadline ? Number(deadline) : undefined,
          demo_scenario: scenario,
        },
        () => setWaking(true)
      );
      if (!state.routes.length) throw new Error(t.noRoutes);
      setQuote(state);
      setScreen("quote");
    } catch (e) {
      setError(e instanceof Error ? (e.message === "API_UNREACHABLE" ? t.apiDown : e.message) : t.rateError);
    } finally {
      setBusy(false);
      setWaking(false);
    }
  };

  const send = async (routeName: string) => {
    setBusy(true);
    setWaking(false);
    setError(null);
    try {
      const state = await executeTransfer(
        {
          amount: amountValue,
          recipient_name: recipient.trim() || undefined,
          payout_method: payoutMethod,
          selected_route_name: routeName,
          demo_scenario: scenario,
          quote_id: quote?.quote_id ?? undefined,
          confirmed: Boolean(quote?.quote_id),
        },
        () => setWaking(true)
      );
      setResult(state);
      if (state.error === "quote_expired" || state.error === "quote_already_used") {
        setError(t.quoteExpiredMsg);
        setScreen("send");
        return;
      }
      if (state.decision === "CLEAR") setScreen("receipt");
      else if (state.decision === "BLOCKED") setError(t.blocked);
      else setScreen("review");
    } catch (e) {
      setError(e instanceof Error ? (e.message === "API_UNREACHABLE" ? t.apiDown : e.message) : t.sendError);
    } finally {
      setBusy(false);
      setWaking(false);
    }
  };

  if (screen === "quote" && quote) {
    return (
      <QuoteScreen
        quote={quote}
        lang={lang}
        onLang={switchLang}
        healthOk={healthOk}
        onRetryHealth={checkHealth}
        busy={busy}
        waking={waking}
        error={error}
        onSend={send}
        onBack={() => setScreen("send")}
      />
    );
  }

  if (screen === "review") {
    return <ReviewScreen lang={lang} onLang={switchLang} healthOk={healthOk} onRetryHealth={checkHealth} onDone={reset} />;
  }

  if (screen === "receipt" && result) {
    return (
      <ReceiptScreen
        result={result}
        lang={lang}
        onLang={switchLang}
        healthOk={healthOk}
        onRetryHealth={checkHealth}
        arrivalHours={quote?.routes.find((r) => r.name === result.transaction?.route_selected)?.settlement_time_hrs}
        onRestart={reset}
      />
    );
  }

  return (
    <div className="xpay-shell min-h-screen flex flex-col">
      <TopBar lang={lang} onLang={switchLang} healthOk={healthOk} onRetryHealth={checkHealth} active="send" />

      <main className="flex-1">
        <div className="mx-auto max-w-[560px] px-5 py-8 sm:px-6">
          <div className="mb-6">
            <p className="text-xs font-semibold tracking-wide text-[#6B6B66] mb-2">{t.sendMoneyTitle}</p>
            <h1 className="text-2xl font-bold tracking-tight text-[#1A1A18]">{t.sendMoneySubtitle}</h1>
          </div>

          <div className="mb-6">
            <ProgressRail current="send" lang={lang} />
          </div>

          <div className="xpay-card xpay-fade-up p-6 sm:p-7">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (Number.isFinite(amountValue) && amountValue > 0 && !busy) getBestRate();
              }}
              className="space-y-6"
            >
              <div>
                <label htmlFor="amount" className="mb-2 block text-sm font-semibold text-[#1A1A18]">
                  {t.youSendLabel}
                </label>
                <div className="flex items-center gap-3 rounded-xl border border-[#E7E5E0] bg-white px-4 py-2 focus-within:border-[#1A1A18]">
                  <input
                    id="amount"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-right text-[32px] font-semibold tracking-tight text-[#1A1A18] outline-none xpay-mono"
                  />
                  <span className="text-sm font-semibold text-[#6B6B66]">AED</span>
                  <MicButton
                    onTranscript={(text) => {
                      setTranscript(text);
                      const m = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
                      if (m) setAmount(m[1]);
                    }}
                    disabled={busy}
                    titleMic={t.micTitle}
                    titleListening={t.micListening}
                    titleUnsupported={t.micUnsupported}
                  />
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {["500", "1,000", "2,500", "5,000"].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmount(val)}
                      className="rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] py-2 text-sm font-semibold text-[#1A1A18] hover:border-[#1A1A18] hover:bg-white transition"
                    >
                      {val}
                    </button>
                  ))}
                </div>
                {transcript && (
                  <p className="mt-2 text-sm text-[#6B6B66]">
                    {t.heard}: “{transcript}”
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-[#1A1A18]">{t.recipientChannel}</p>
                <div className="grid gap-2">
                  {PAYOUT_OPTIONS(t).map((opt) => {
                    const selected = payoutMethod === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPayoutMethod(opt.value)}
                        aria-pressed={selected}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                          selected ? "border-[#1A1A18] bg-[#1A1A18] text-white" : "border-[#E7E5E0] bg-white text-[#1A1A18] hover:border-[#6B6B66]"
                        }`}
                      >
                        <span>
                          <span className="text-sm font-semibold">{opt.label}</span>
                          <span className={`ml-2 text-xs ${selected ? "text-white/70" : "text-[#6B6B66]"}`}>· {opt.detail}</span>
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            selected ? "bg-white text-[#1A1A18]" : opt.badge === t.payoutBadgeBonus ? "bg-[#FAFAF8] text-[#D97706] border border-[#E7E5E0]" : "bg-[#FAFAF8] text-[#6B6B66] border border-[#E7E5E0]"
                          }`}
                        >
                          {opt.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-[#1A1A18]">{t.arriveBy}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: "", label: t.arrivalAny },
                    { v: "3", label: t.arrival3h },
                    { v: "12", label: t.arrival12h },
                    { v: "24", label: t.arrival24h },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setDeadline(opt.v)}
                      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                        deadline === opt.v ? "border-[#1A1A18] bg-[#1A1A18] text-white" : "border-[#E7E5E0] bg-white text-[#6B6B66] hover:border-[#1A1A18] hover:text-[#1A1A18]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="recipient" className="mb-2 block text-sm font-semibold text-[#1A1A18]">
                  {t.recipientOptional}
                </label>
                <input
                  id="recipient"
                  autoComplete="off"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={t.recipientNamePlaceholder}
                  className="w-full rounded-xl border border-[#E7E5E0] bg-white px-4 py-3 text-sm text-[#1A1A18] outline-none placeholder:text-[#6B6B66] focus:border-[#1A1A18]"
                />
              </div>

              {error && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[#B91C1C]/20 bg-[#B91C1C]/5 p-3 text-sm text-[#B91C1C]">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => getBestRate()}
                    className="shrink-0 rounded-lg border border-[#B91C1C]/20 bg-white px-3 py-1 text-xs font-semibold hover:bg-[#FAFAF8]"
                  >
                    {t.retry}
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={!Number.isFinite(amountValue) || amountValue <= 0 || busy}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D97706] text-sm font-semibold text-white transition hover:bg-[#B45309] disabled:opacity-40"
              >
                {busy ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
                    {waking ? t.wakingUp : t.evaluating}
                  </span>
                ) : (
                  <>
                    {t.bestRateBtn}
                    <ArrowRight size={16} strokeWidth={1.75} />
                  </>
                )}
              </button>

              <p className="flex items-start gap-2 rounded-xl bg-[#FAFAF8] border border-[#E7E5E0] px-3 py-2.5 text-xs leading-relaxed text-[#6B6B66]">
                <Shield size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#6B6B66]" />
                {t.trustStrip}
              </p>

              <div className="border-t border-[#E7E5E0] pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowDemoControls(!showDemoControls)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B6B66] hover:text-[#1A1A18]"
                >
                  <Settings size={14} strokeWidth={1.75} />
                  {t.demoControls}
                  <ChevronDown size={14} strokeWidth={1.75} className={`transition ${showDemoControls ? "rotate-180" : ""}`} />
                </button>
                <span className="text-xs text-[#6B6B66]">{t.quoteExpires}</span>
              </div>
              {showDemoControls && (
                <div className="rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] p-3">
                  <p className="mb-2 text-xs font-semibold text-[#1A1A18]">{t.demoScenarioLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    {SCENARIOS(t).map((sc) => (
                      <button
                        key={sc.key}
                        type="button"
                        onClick={() => setScenario(sc.key)}
                        title={sc.desc}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                          scenario === sc.key ? "border-[#1A1A18] bg-[#1A1A18] text-white" : "border-[#E7E5E0] bg-white text-[#6B6B66] hover:border-[#1A1A18]"
                        }`}
                      >
                        {sc.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </main>

      <Footer lang={lang} />
    </div>
  );
}

function QuoteScreen({
  quote,
  lang,
  onLang,
  healthOk,
  onRetryHealth,
  busy,
  waking,
  error,
  onSend,
  onBack,
}: {
  quote: AgentStateResponse;
  lang: Lang;
  onLang: (l: Lang) => void;
  healthOk: boolean | null;
  onRetryHealth: () => void;
  busy: boolean;
  waking: boolean;
  error: string | null;
  onSend: (route: string) => void;
  onBack: () => void;
}) {
  const t = STRINGS[lang];
  const bestPossible =
    quote.routes.find((r) => r.is_best) ??
    quote.routes.find((r) => r.pricing_completeness === "complete" && r.breakdown.true_net_receive_bdt != null) ??
    quote.routes[0];
  const [selectedName, setSelectedName] = useState(bestPossible.name);
  const selected = quote.routes.find((r) => r.name === selectedName) ?? bestPossible;
  const marketValue = (selected.breakdown.amount_source ?? 0) * selected.mid_market_rate;
  const netValue = selected.breakdown.true_net_receive_bdt ?? 0;
  const valueDifference = marketValue - netValue;
  const forfeitRate =
    quote.routes.find((r) => r.incentive_eligible && (r.breakdown.govt_incentive_rate ?? 0) > 0)?.breakdown.govt_incentive_rate ?? null;

  const whyBody =
    selected.is_best
      ? t.whyBestBody(selected.rail)
      : t.whyWorseBody(selected.rail, Math.abs(selected.advantage_bdt_vs_best ?? 0));

  return (
    <div className="xpay-shell min-h-screen flex flex-col">
      <TopBar lang={lang} onLang={onLang} healthOk={healthOk} onRetryHealth={onRetryHealth} active="send" />
      <main className="flex-1">
        <div className="mx-auto max-w-[980px] px-5 py-6 sm:px-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <button onClick={onBack} className="text-sm font-semibold text-[#D97706] hover:text-[#B45309]">
              {t.changeLabel}
            </button>
            <span className="text-xs text-[#6B6B66]">
              {t.quoteIdLabel}: {quote.quote_id?.slice(0, 10)}… · {t.quoteExpires}
            </span>
          </div>

          <div className="mb-6">
            <ProgressRail current="quote" lang={lang} />
          </div>

          <div className="xpay-card p-6 sm:p-8 mb-6 xpay-fade-up">
            <p className="text-xs font-semibold tracking-wide text-[#6B6B66]">{t.recipientReceives}</p>
            <p className="mt-1 text-5xl font-semibold tracking-tight text-[#1A1A18] xpay-mono">{fmtBDT(selected.breakdown.true_net_receive_bdt)}</p>
            {selected.breakdown.govt_incentive_added_bdt != null && (
              <p className="mt-2 text-sm text-[#6B6B66]">
                {t.includesBonus(fmtBDT(selected.breakdown.govt_incentive_added_bdt))} · {t.demoCorridorName} · {selected.rail} → {selected.payout_method}
              </p>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
            <section className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-[#1A1A18]">{t.compareAllRoutes}</h2>
                <span className="text-xs text-[#6B6B66]">{t.optionsEvaluated(quote.routes.length)}</span>
              </div>
              <p className="text-xs text-[#6B6B66]">{t.rankedBy}</p>

              <div className="space-y-2">
                {quote.routes.map((route, index) => {
                  const forfeited =
                    route.incentive_eligible || route.breakdown.gross_bdt == null || !(forfeitRate && forfeitRate > 0)
                      ? null
                      : route.breakdown.gross_bdt * forfeitRate;
                  const isSelected = route.name === selected.name;
                  const isBest = route.is_best;
                  return (
                    <button
                      key={route.name}
                      type="button"
                      onClick={() => setSelectedName(route.name)}
                      aria-checked={isSelected}
                      role="radio"
                      className={`w-full rounded-xl border bg-white p-4 text-left transition ${
                        isSelected ? "border-[#1A1A18]" : isBest ? "border-[#D97706] border-l-4" : "border-[#E7E5E0] hover:border-[#6B6B66]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                            isBest ? "border-[#D97706] bg-[#D97706] text-white" : "border-[#E7E5E0] bg-[#FAFAF8] text-[#6B6B66]"
                          }`}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-[#1A1A18]">{route.rail}</span>
                            {isBest && (
                              <span className="rounded-full bg-[#D97706] px-2 py-0.5 text-xs font-semibold text-white">{t.recommended}</span>
                            )}
                            {isSelected && <span className="ml-auto h-2 w-2 rounded-full bg-[#1A1A18]" aria-hidden="true" />}
                          </div>
                          <p className="mt-0.5 text-xs text-[#6B6B66]">
                            {route.payout_method} · {route.incentive_eligible ? t.incentiveEligible : t.noIncentive} · {t.hoursArrival(route.settlement_time_hrs)} · {t.feeTag(fmtCurrency(route.fee_total_source, DEMO_CORRIDOR.sourceCur))}
                          </p>
                          {forfeited && forfeited > 0.5 && !route.incentive_eligible && (
                            <p className="mt-1 text-xs text-[#B45309]">{t.forfeitsBonus(fmtBDT(forfeited))}</p>
                          )}
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-[#1A1A18] xpay-mono">{fmtBDT(route.breakdown.true_net_receive_bdt)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="space-y-4">
              <div className="xpay-card p-5">
                <p className="text-xs font-semibold text-[#6B6B66]">{t.whyThisRouteTitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#1A1A18]">{whyBody}</p>
                <div className="mt-4 space-y-2 border-t border-[#E7E5E0] pt-4 text-sm">
                  <Row label={t.amountSent} value={fmtCurrency(selected.breakdown.amount_source, DEMO_CORRIDOR.sourceCur)} />
                  <Row label={t.fxRateLabel} value={t.fxRate(selected.fx_rate.toFixed(2))} />
                  <Row label={t.fxMidLabel} value={`1 ${DEMO_CORRIDOR.sourceCur} = ${selected.mid_market_rate.toFixed(2)} BDT`} />
                  <Row label={t.routeFee} value={fmtCurrency(selected.fee_total_source, DEMO_CORRIDOR.sourceCur)} />
                  {(selected.platform_fee_source ?? 0) > 0 && (
                    <Row label={t.ofWhichXpay} value={fmtCurrency(selected.platform_fee_source, DEMO_CORRIDOR.sourceCur)} />
                  )}
                  <Row label={t.arrivalLabel} value={t.arrivalHours(selected.settlement_time_hrs)} />
                  <div className="my-2 border-t border-dashed border-[#E7E5E0] pt-2 space-y-2">
                    <Row label={t.midMarketValue} value={fmtBDT(marketValue)} />
                    <Row label={t.recipientNet} value={fmtBDT(netValue)} />
                    <Row label={t.difference} value={`${valueDifference >= 0 ? "−" : "+"}${fmtBDT(Math.abs(valueDifference))}`} />
                  </div>
                </div>
              </div>

              <AgentPipeline quote={quote} busy={busy} t={t} />

              {quote.decision === "CLEAR" ? (
                <div className="rounded-xl border border-[#047857]/20 bg-[#047857]/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#047857]">
                    <Shield size={16} strokeWidth={1.75} /> {t.complianceCleared}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[#1A1A18]">{t.complianceClearedBody}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-[#B45309]/20 bg-[#B45309]/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[#B45309]">
                    <Shield size={16} strokeWidth={1.75} /> {quote.decision === "FUZZY_MATCH_REVIEW" ? t.complianceHoldTitle : t.complianceReviewTitle}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[#1A1A18]">{quote.decision === "FUZZY_MATCH_REVIEW" ? t.holdBody : t.reviewBody}</p>
                </div>
              )}

              {error && <p className="rounded-xl border border-[#B91C1C]/20 bg-[#B91C1C]/5 p-3 text-sm text-[#B91C1C]">{error}</p>}

              <button
                onClick={() => onSend(selected.name)}
                disabled={busy}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#D97706] text-sm font-semibold text-white hover:bg-[#B45309] disabled:opacity-40"
              >
                {busy ? (waking ? t.wakingUp : t.sending) : t.sendWith(selected.rail)}
                {!busy && <ArrowRight size={16} strokeWidth={1.75} />}
                {busy && <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />}
              </button>
              <p className="text-center text-xs text-[#6B6B66]">{t.confirmExactQuote}</p>
            </aside>
          </div>
        </div>
      </main>
      <Footer lang={lang} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-[#6B6B66]">{label}</span>
      <span className="xpay-mono font-semibold text-[#1A1A18] text-right">{value}</span>
    </div>
  );
}

function ReviewScreen({
  lang,
  onLang,
  healthOk,
  onRetryHealth,
  onDone,
}: {
  lang: Lang;
  onLang: (l: Lang) => void;
  healthOk: boolean | null;
  onRetryHealth: () => void;
  onDone: () => void;
}) {
  const t = STRINGS[lang];
  return (
    <div className="xpay-shell min-h-screen flex flex-col">
      <TopBar lang={lang} onLang={onLang} healthOk={healthOk} onRetryHealth={onRetryHealth} active="send" />
      <main className="flex-1">
        <div className="mx-auto max-w-[560px] px-5 py-12 sm:px-6">
          <div className="mb-6">
            <ProgressRail current="review" lang={lang} />
          </div>
          <div className="xpay-card p-8 text-center xpay-fade-up">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#E7E5E0] bg-[#FAFAF8] text-[#B45309]">
              <Shield size={28} strokeWidth={1.75} />
            </div>
            <p className="text-xs font-semibold tracking-wide text-[#6B6B66] mt-6">{t.inReview}</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1A1A18]">{t.reviewPauseTitle}</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#6B6B66]">
              {t.reviewSentence} {t.reviewSafeNote}
            </p>
            <button
              onClick={onDone}
              className="mt-6 rounded-xl bg-[#1A1A18] px-6 py-3 text-sm font-semibold text-white hover:bg-black"
            >
              {t.gotIt}
            </button>
          </div>
        </div>
      </main>
      <Footer lang={lang} />
    </div>
  );
}

function ReceiptScreen({
  result,
  lang,
  onLang,
  healthOk,
  onRetryHealth,
  arrivalHours,
  onRestart,
}: {
  result: AgentStateResponse;
  lang: Lang;
  onLang: (l: Lang) => void;
  healthOk: boolean | null;
  onRetryHealth: () => void;
  arrivalHours?: number;
  onRestart: () => void;
}) {
  const t = STRINGS[lang];
  const tx = result.transaction;
  if (!tx) return null;
  const execution = result.execution;
  return (
    <div className="xpay-shell min-h-screen flex flex-col">
      <TopBar lang={lang} onLang={onLang} healthOk={healthOk} onRetryHealth={onRetryHealth} active="send" />
      <main className="flex-1">
        <div className="mx-auto max-w-[640px] px-5 py-8 sm:px-6">
          <div className="mb-6">
            <ProgressRail current="receipt" lang={lang} />
          </div>

          <div className="xpay-card overflow-hidden xpay-fade-up">
            <div className="bg-[#FAFAF8] p-6 sm:p-8 border-b border-[#E7E5E0] text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#047857] text-white">
                <Check size={24} strokeWidth={1.75} />
              </div>
              <p className="text-xs font-semibold tracking-wide text-[#6B6B66] mt-4">{t.cleared}</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight text-[#1A1A18] xpay-mono">{fmtBDT(tx.true_net_receive_bdt)}</p>
              <p className="mt-2 text-sm text-[#6B6B66]">{t.arrivingVia(arrivalHours ?? 2, tx.route_selected ?? "—")}</p>
              <h1 className="mt-1 text-sm font-semibold text-[#1A1A18]">{t.sent}</h1>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow label={t.amountRow} value={fmtCurrency(tx.amount_source, DEMO_CORRIDOR.sourceCur)} />
                <DetailRow label={t.recipientLabel} value={`${tx.recipient_name} (${tx.recipient_handle})`} />
                <DetailRow label={t.routeRow} value={tx.route_selected ?? "—"} />
                <DetailRow label={t.referenceRow} value={tx.transaction_id} mono />
              </div>

              {tx.stellar_hash && (
                <ChainTrail
                  hash={tx.stellar_hash}
                  network={execution?.network ?? "SIMULATED"}
                  labels={{
                    title: t.simulatedTrailLabel,
                    prev: t.blockPrev,
                    yours: t.blockYours,
                    next: t.blockNext,
                    copyHash: t.ctCopyHash,
                    copied: t.ctCopied,
                  }}
                />
              )}

              <AgentPipeline quote={result} t={t} />

              <details className="rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] p-4">
                <summary className="cursor-pointer text-sm font-semibold text-[#1A1A18]">
                  {t.technicalDetails} {t.payloadSuffix}
                </summary>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-white border border-[#E7E5E0] p-4 text-xs font-mono text-[#1A1A18] leading-relaxed">
                  {JSON.stringify(tx.iso_20022, null, 2)}
                </pre>
              </details>

              <button
                onClick={onRestart}
                className="h-12 w-full rounded-xl border border-[#E7E5E0] bg-white text-sm font-semibold text-[#1A1A18] hover:border-[#1A1A18] hover:bg-[#FAFAF8]"
              >
                {t.sendAnother}
              </button>
            </div>
          </div>
        </div>
      </main>
      <Footer lang={lang} />
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-[#E7E5E0] bg-[#FAFAF8] px-4 py-3">
      <p className="text-xs text-[#6B6B66]">{label}</p>
      <p className={`mt-1 text-sm font-semibold text-[#1A1A18] ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</p>
    </div>
  );
}
