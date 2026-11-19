"use client";
export interface FlowStep { title: string; desc: string; }
export default function FlowDiagram({ steps }: { steps: FlowStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#E3E6EA] text-xs font-semibold text-[#5C6470] bg-white">{i + 1}</span>
            {i < steps.length - 1 && <span className="w-px flex-1 bg-[#E3E6EA]" aria-hidden="true" />}
          </div>
          <div className={i < steps.length - 1 ? "pb-4" : ""}>
            <p className="text-sm font-medium text-[#17181C] leading-tight">{step.title}</p>
            <p className="text-sm text-[#5C6470]">{step.desc}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
