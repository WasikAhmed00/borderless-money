"use client";
import { useState } from "react";
export default function ChainTrail({ hash, network, labels }: { hash: string; network: string; labels: { title: string; prev: string; yours: string; next: string; copyHash?: string; copied?: string } }) {
  const [copied, setCopied] = useState(false);
  const shortHash = hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : "—";
  const copyHash = () => { if (!hash) return; navigator.clipboard?.writeText(hash); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const blocks = [{ label: labels.prev, value: "···", accent: false }, { label: labels.yours, value: shortHash, accent: true }, { label: labels.next, value: "···", accent: false }];
  return (
    <section aria-label={labels.title} className="rounded-xl border border-[#DCE3EC] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[#0C2340]">{labels.title}</h3>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-[#DCE3EC] bg-[#F4F7FB] px-2 py-0.5 font-mono text-xs font-medium text-[#64748B]">{network}</span>
          {hash && <button type="button" onClick={copyHash} className="rounded-md border border-[#DCE3EC] bg-white px-2 py-0.5 text-xs font-medium text-[#64748B] hover:text-[#0C2340] hover:border-[#0C2340] transition">{copied ? (labels.copied ?? "Copied") : (labels.copyHash ?? "Copy hash")}</button>}
        </div>
      </div>
      <div className="flex items-stretch gap-2">
        {blocks.map((block, i) => (
          <div key={block.label} className="flex min-w-0 flex-1 items-center">
            {i > 0 && <span className="h-px w-3 shrink-0 bg-[#DCE3EC]" aria-hidden="true" />}
            <div className={`min-w-0 flex-1 rounded-lg border p-3 text-center ${block.accent ? "border-[#0C2340] bg-[#F4F7FB]" : "border-[#DCE3EC] bg-white"}`}>
              <p className={`truncate font-mono text-xs font-semibold ${block.accent ? "text-[#0C2340]" : "text-[#64748B]"}`}>{block.value}</p>
              <p className="mt-1 truncate text-xs text-[#64748B]">{block.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
