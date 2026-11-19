"use client";
import { useEffect, useMemo, useState } from "react";
import BrandMark from "@/components/BrandMark";
import { STRINGS, applyDocLang, savedLang } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
type ScenarioKey = "conservative" | "base" | "optimistic";
interface Inputs { monthlyTransfers: number; avgPrincipal: number; baselinePct: number; proposedPct: number; eligibilityShare: number; adoptionRate: number; apiPricePerTx: number; apiMonthlyFee: number; bearingShare: number; customerMonthlyCosts: number; vendorVariableCostPerTx: number | null; }
const DEFAULTS: Inputs = { monthlyTransfers: 5000, avgPrincipal: 1000, baselinePct: 1.5, proposedPct: 0.9, eligibilityShare: 0.8, adoptionRate: 0.5, apiPricePerTx: 1.0, apiMonthlyFee: 0, bearingShare: 1.0, customerMonthlyCosts: 500, vendorVariableCostPerTx: 0.25 };
const SCENARIOS: Record<ScenarioKey,{adoptMult:number;eligMult:number}> = { conservative:{adoptMult:0.5,eligMult:0.8}, base:{adoptMult:1,eligMult:1}, optimistic:{adoptMult:1.5,eligMult:1.0} };
const round2=(x:number)=>Math.round(x*100)/100; const ceil=(x:number)=>Math.ceil(round2(x));
function compute(i:Inputs,key:ScenarioKey){ const {adoptMult,eligMult}=SCENARIOS[key]; const eligibility=Math.min(i.eligibilityShare*eligMult,1); const adoption=Math.min(i.adoptionRate*adoptMult,1); const eligible=round2(i.monthlyTransfers*eligibility); const adopted=round2(eligible*adoption); const principalMoved=round2(adopted*i.avgPrincipal); const gapPct=(i.baselinePct-i.proposedPct)/100; const recipientBenefit=round2(principalMoved*gapPct); const customerSavings=round2(recipientBenefit*i.bearingShare); const apiRevenue=round2(adopted*i.apiPricePerTx+i.apiMonthlyFee); const customerNet=round2(customerSavings-apiRevenue-i.customerMonthlyCosts); const costPerTx=adopted>0?round2(apiRevenue/adopted):null; const marginPct=i.vendorVariableCostPerTx!=null && apiRevenue>0 ? round2(((apiRevenue-adopted*i.vendorVariableCostPerTx)/apiRevenue)*100) : null; const savingPerAdopted=round2(i.avgPrincipal*gapPct*i.bearingShare-i.apiPricePerTx); const fixedDrag=i.apiMonthlyFee+i.customerMonthlyCosts; let breakeven:number|null; let breakevenNote:string; if(fixedDrag===0){breakeven=0;breakevenNote="none";} else if(savingPerAdopted<=0||eligibility===0||adoption===0){breakeven=null;breakevenNote="negative";} else {breakeven=ceil(fixedDrag/(eligibility*adoption*savingPerAdopted)); breakevenNote="payoff";} return {eligible,adopted,principalMoved,recipientBenefit,customerSavings,apiRevenue,customerNet,costPerTx,marginPct,breakeven,breakevenNote};}
const fmt=(x:number|null,cur="AED")=> x==null?"—":`${cur?cur+" ":""}${x.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
function Field(props:{label:string;hint:string;value:number;onChange:(v:number)=>void;step?:number;min?:number;max?:number;suffix?:string}){return (<label className="block"><div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-[#0C2340]">{props.label}</span><span className="text-xs text-[#94A3B8] font-mono">{props.hint}</span></div><div className="relative flex items-center"><input type="number" className="w-full rounded-lg border border-[#DCE3EC] bg-white px-3 py-2 pr-12 text-sm text-[#0C2340] focus:border-[#0070E0] focus:ring-2 focus:ring-[#0070E0]/20 outline-none" value={props.value} step={props.step??1} min={props.min??0} max={props.max} onChange={(e)=>props.onChange(Number(e.target.value))} />{props.suffix && <span className="absolute right-3 text-xs text-[#94A3B8] font-mono pointer-events-none">{props.suffix}</span>}</div></label>);}
function LangToggle({lang,onLang}:{lang:Lang;onLang:(l:Lang)=>void}){return (<div className="flex rounded-lg border border-[#DCE3EC] bg-[#F4F7FB] p-1 text-xs font-semibold"><button type="button" onClick={()=>onLang("en")} className={`rounded-md px-2.5 py-1 ${lang==="en"?"bg-white border border-[#DCE3EC] text-[#0C2340] shadow-sm":"text-[#64748B] hover:text-[#0C2340]"}`}>EN</button><button type="button" onClick={()=>onLang("bn")} className={`rounded-md px-2.5 py-1 ${lang==="bn"?"bg-white border border-[#DCE3EC] text-[#0C2340] shadow-sm":"text-[#64748B] hover:text-[#0C2340]"}`}>বাং</button></div>);}
function RoiTopBar({lang,onLang}:{lang:Lang;onLang:(l:Lang)=>void}){const t=STRINGS[lang]; return (<header className="sticky top-0 z-30 border-b border-[#DCE3EC] bg-white" style={{height:64}}><div className="xpay-container flex h-full items-center justify-between gap-4"><div className="flex items-center gap-6"><a href="/" className="flex items-center"><BrandMark /></a><nav className="hidden sm:flex items-center gap-6 text-sm"><a href="/" className="pb-1 font-medium border-b-2 border-transparent text-[#64748B] hover:text-[#0C2340]">{t.navSend}</a><a href="/roi" className="pb-1 font-medium border-b-2 border-[#0070E0] text-[#0C2340]">{t.navRoi}</a></nav></div><div className="flex items-center gap-3"><LangToggle lang={lang} onLang={onLang} /></div></div></header>);}
export default function RoiPage(){
  const [lang,setLang]=useState<Lang>("en"); const [i,setI]=useState<Inputs>(DEFAULTS); const [active,setActive]=useState<ScenarioKey>("base"); const r=useMemo(()=>compute(i,active),[i,active]); const set=(k:keyof Inputs)=>(v:number)=>setI(p=>({...p,[k]:v})); const t=STRINGS[lang]; useEffect(()=>{const l=savedLang(); setLang(l); applyDocLang(l);},[]); const switchLang=(l:Lang)=>{setLang(l); window.localStorage.setItem("xpay-lang",l); applyDocLang(l);}; const breakevenNoteText= r.breakevenNote==="none"?t.roi.breakevenNone : r.breakevenNote==="negative"?t.roi.breakevenNegative : t.roi.breakevenPayoff;
  return (
    <div className="xpay-shell min-h-screen flex flex-col">
      <RoiTopBar lang={lang} onLang={switchLang} />
      <main className="flex-1 xpay-container py-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#DCE3EC] bg-white px-3 py-1 text-xs font-medium text-[#64748B] mb-3">{t.roiHonestyBadge}</div>
        <h1 className="text-[28px] font-bold tracking-tight text-[#0C2340]">{t.roi.title}</h1>
        <p className="mt-2 text-sm text-[#64748B] max-w-2xl leading-relaxed">{t.roi.lead} {t.roi.formulasPrefix} <code className="rounded bg-white border border-[#DCE3EC] px-1 font-mono text-xs">backend/app/services/roi.py</code> {t.roi.formulasSuffix}</p>
        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-[#DCE3EC] bg-white p-2">
          <span className="px-3 text-xs font-semibold text-[#0C2340]">{t.roi.adoptionScenario}:</span>
          {(Object.keys(SCENARIOS) as ScenarioKey[]).map(k=>(
            <button key={k} onClick={()=>setActive(k)} className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${active===k ? "bg-[#E8F1FC] border border-[#0070E0] text-[#0C2340]" : "text-[#64748B] hover:text-[#0C2340] border border-transparent"}`}>{t.roi.scenarios[k]}</button>
          ))}
          <span className="text-xs text-[#64748B] ml-auto pr-3 hidden md:inline">{t.roi.scenarioNote(SCENARIOS[active].adoptMult, SCENARIOS[active].eligMult)}</span>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="xpay-card p-6">
            <h2 className="text-sm font-semibold text-[#0C2340]">{t.roi.yourAssumptions}</h2>
            <p className="text-xs text-[#64748B] mb-5">{t.roi.assumptionsNote}</p>
            <div className="space-y-6">
              <fieldset className="rounded-xl border border-[#DCE3EC] p-4"><legend className="px-2 xpay-eyebrow">{t.roiVolume}</legend><div className="grid grid-cols-2 gap-4"><Field label={t.roi.fields.monthlyTransfers.label} hint={t.roi.fields.monthlyTransfers.hint} value={i.monthlyTransfers} onChange={set("monthlyTransfers")} min={1} /><Field label={t.roi.fields.avgPrincipal.label} hint={t.roi.fields.avgPrincipal.hint} value={i.avgPrincipal} onChange={set("avgPrincipal")} step={50} suffix="AED" /></div></fieldset>
              <fieldset className="rounded-xl border border-[#DCE3EC] p-4"><legend className="px-2 xpay-eyebrow">{t.roiPricing}</legend><div className="grid grid-cols-2 gap-4"><Field label={t.roi.fields.baselineCost.label} hint={t.roi.fields.baselineCost.hint} value={i.baselinePct} onChange={set("baselinePct")} step={0.1} suffix="%" /><Field label={t.roi.fields.proposedCost.label} hint={t.roi.fields.proposedCost.hint} value={i.proposedPct} onChange={set("proposedPct")} step={0.1} suffix="%" /><Field label={t.roi.fields.apiPrice.label} hint={t.roi.fields.apiPrice.hint} value={i.apiPricePerTx} onChange={set("apiPricePerTx")} step={0.1} suffix="AED" /><Field label={t.roi.fields.apiMonthlyFee.label} hint={t.roi.fields.apiMonthlyFee.hint} value={i.apiMonthlyFee} onChange={set("apiMonthlyFee")} step={50} suffix="AED" /></div></fieldset>
              <fieldset className="rounded-xl border border-[#DCE3EC] p-4"><legend className="px-2 xpay-eyebrow">{t.roiAssumptions}</legend><div className="grid grid-cols-2 gap-4"><Field label={t.roi.fields.eligibilityShare.label} hint={t.roi.fields.eligibilityShare.hint} value={i.eligibilityShare} onChange={set("eligibilityShare")} step={0.05} max={1} /><Field label={t.roi.fields.adoptionRate.label} hint={t.roi.fields.adoptionRate.hint} value={i.adoptionRate} onChange={set("adoptionRate")} step={0.05} max={1} /><Field label={t.roi.fields.bearingShare.label} hint={t.roi.fields.bearingShare.hint} value={i.bearingShare} onChange={set("bearingShare")} step={0.1} max={1} /><Field label={t.roi.fields.monthlyCosts.label} hint={t.roi.fields.monthlyCosts.hint} value={i.customerMonthlyCosts} onChange={set("customerMonthlyCosts")} step={50} suffix="AED" /><Field label={t.roi.fields.vendorCost.label} hint={t.roi.fields.vendorCost.hint} value={i.vendorVariableCostPerTx ?? 0} onChange={(v)=>setI(p=>({...p,vendorVariableCostPerTx:v}))} step={0.05} suffix="AED" /></div></fieldset>
            </div>
          </section>
          <section className="xpay-card p-6 flex flex-col">
            <div className="pb-3 mb-4 flex items-center justify-between border-b border-[#DCE3EC]"><div><h2 className="text-sm font-semibold text-[#0C2340]">{t.roi.outcomeTitle(t.roi.scenarios[active])}</h2><p className="text-xs text-[#64748B]">{t.roi.outcomeNote}</p></div>{r.marginPct!=null && <span className="rounded-full border border-[#DCE3EC] bg-[#F4F7FB] px-3 py-1 text-xs font-mono font-semibold text-[#0C2340]">{t.roi.marginBadge(r.marginPct)}</span>}</div>
            <dl className="space-y-0 text-sm">
              {[
                [t.roi.rows.eligibleTransfers, fmt(r.eligible,""), false],
                [t.roi.rows.adoptedTransfers, fmt(r.adopted,""), false],
                [t.roi.rows.principalRouted, fmt(r.principalMoved), false],
                [t.roi.rows.recipientBenefit, fmt(r.recipientBenefit), false],
                [t.roi.rows.costSavings, fmt(r.customerSavings), false],
                [t.roi.rows.apiRevenue, fmt(r.apiRevenue), false],
                [t.roi.rows.netBenefit, fmt(r.customerNet), true],
                [t.roi.rows.costPerTx, fmt(r.costPerTx), false],
                [t.roi.rows.vendorMargin, r.marginPct==null?"—":`${r.marginPct}%`, false],
                [t.roi.rows.breakevenVolume, r.breakeven==null?"—":t.roi.transfersPerMonth(r.breakeven), true],
              ].map(([k,v,highlight])=>(
                <div key={k as string} className={`flex items-baseline justify-between gap-4 border-b px-3 py-2.5 ${highlight ? "bg-[#E8F1FC] border-[#0070E0]/30 rounded-lg border" : "border-[#DCE3EC] border-dashed"}`}>
                  <dt className="text-[#64748B] text-xs">{k as string}</dt><dd className="font-mono font-semibold text-[#0C2340] text-right">{v as string}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-[#64748B]">{breakevenNoteText}.</p>
            <div className="mt-6 rounded-xl border border-[#DCE3EC] bg-[#F4F7FB] p-3.5 text-xs leading-relaxed text-[#0C2340]"><strong className="font-semibold">{t.roi.honestyTitle}</strong> {t.roi.honestyBody}</div>
          </section>
        </div>
      </main>
      <footer className="border-t border-[#DCE3EC] bg-white"><div className="xpay-container py-4 text-center text-xs text-[#64748B]">{t.honestyFooter}</div></footer>
    </div>
  );
}
