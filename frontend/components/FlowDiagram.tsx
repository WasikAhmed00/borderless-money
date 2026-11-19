"use client";

export interface FlowStep {
  title: string;
  desc: string;
}

export default function FlowDiagram({ steps }: { steps: FlowStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#E7E5E0] text-xs font-semibold text-[#6B6B66] bg-white">
              {i + 1}
            </span>
            {i < steps.length - 1 && <span className="w-px flex-1 bg-[#E7E5E0]" aria-hidden="true" />}
          </div>
          <div className={i < steps.length - 1 ? "pb-4" : ""}>
            <p className="text-sm font-semibold text-[#1A1A18] leading-tight">{step.title}</p>
            <p className="text-sm text-[#6B6B66]">{step.desc}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
