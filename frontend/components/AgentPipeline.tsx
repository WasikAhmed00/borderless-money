"use client";
import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import type { STRINGS } from "@/lib/i18n";
import type { AgentStateResponse } from "@/lib/types";
type T = (typeof STRINGS)["en"];
export interface AgentPipelineProps { quote?: AgentStateResponse | null; busy?: boolean; t: T; }
export default function AgentPipeline({ quote, busy, t }: AgentPipelineProps) {
  const [open, setOpen] = useState(false);
  const steps = [
    { id: "intent", title: t.pipeline.intentTitle, desc: quote?.parsed_intent ? `${quote.parsed_intent.amount} ${quote.parsed_intent.source_currency} → ${quote.parsed_intent.dest_currency} via ${quote.parsed_intent.payout_method || "optimal rail"}` : t.pipeline.intentIdle, status: busy ? "processing" : quote ? "completed" : "idle", badge: quote?.parsed_intent?.confidence ? `${Math.round(quote.parsed_intent.confidence * 100)}%` : null },
    { id: "routing", title: t.pipeline.routingTitle, desc: quote?.routes?.length ? t.pipeline.routingDesc(quote.routes.length) : t.pipeline.routingIdle, status: busy ? "processing" : quote?.routes ? "completed" : "idle", badge: quote?.routes?.length ? `${quote.routes.length}` : null },
    { id: "incentive", title: t.pipeline.incentiveTitle, desc: t.pipeline.incentiveIdle, status: busy ? "processing" : quote ? "completed" : "idle", badge: t.pipeline.incentiveBadge },
    { id: "compliance", title: t.pipeline.complianceTitle, desc: quote?.compliance ? `OFAC: ${quote.compliance.ofac_match_status || "—"} · ${quote.risk?.risk_band || "—"}` : t.pipeline.complianceIdle, status: busy ? "processing" : quote?.compliance ? "completed" : "idle", badge: quote?.decision === "CLEAR" ? t.pipeline.compliancePassed : quote?.decision ? String(quote.decision) : null },
    { id: "quote_binding", title: t.pipeline.bindingTitle, desc: quote?.quote_id ? t.pipeline.bindingDesc(quote.quote_id.slice(0, 8)) : t.pipeline.bindingIdle, status: busy ? "processing" : quote?.quote_id ? "completed" : "idle", badge: quote?.quote_id ? t.pipeline.bindingBadge : null },
  ];
  return (
    <div className="rounded-xl border border-[#E3E6EA] bg-white">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-left" aria-expanded={open}>
        <span className="text-sm font-semibold text-[#17181C]">{t.howDecisionMade}</span>
        <span className="flex items-center gap-2">
          <span className="rounded-full border border-[#E3E6EA] bg-[#F6F7F9] px-2 py-0.5 text-xs font-medium text-[#5C6470]">{busy ? t.pipeline.evaluating : quote ? t.pipeline.ready : t.pipeline.standby}</span>
          <ChevronDown size={16} strokeWidth={1.75} className={`text-[#5C6470] transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="border-t border-[#E3E6EA] px-4 py-4 space-y-3">
          {steps.map((step) => {
            const isDone = step.status === "completed";
            return (
              <div key={step.id} className={`flex items-start gap-3 rounded-xl border p-3 ${isDone ? "border-[#E3E6EA] bg-[#F6F7F9]" : "border-[#E3E6EA] bg-white"}`}>
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${isDone ? "border-[#F59E0B] bg-[#F59E0B] text-white" : "border-[#E3E6EA] bg-white text-[#5C6470]"}`} aria-hidden="true">{isDone ? <Check size={12} strokeWidth={1.75} /> : <span className="h-1.5 w-1.5 rounded-full bg-[#8A93A0]" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[#17181C]">{step.title}</p>
                    {step.badge && <span className="rounded-full border border-[#E3E6EA] bg-[#F6F7F9] px-2 py-0.5 text-xs font-medium text-[#5C6470]">{step.badge}</span>}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[#5C6470]">{step.desc}</p>
                </div>
              </div>
            );
          })}
          {quote?.explanation_log && quote.explanation_log.length > 0 && (
            <div className="rounded-xl border border-[#E3E6EA] bg-[#F6F7F9] p-3">
              <p className="text-xs font-semibold text-[#17181C] mb-2">{t.pipeline.logsLabel(quote.explanation_log.length)}</p>
              <div className="max-h-48 overflow-y-auto space-y-1.5 font-mono text-xs text-[#17181C] leading-relaxed">{quote.explanation_log.map((log, i) => (<div key={i} className="flex gap-2"><span className="text-[#5C6470] shrink-0">›</span><span>{log}</span></div>))}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
