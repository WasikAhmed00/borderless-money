import * as React from "react";

export default function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="xPay">
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="28" height="28" rx="7" fill="#F59E0B" />
        {/* arrow: line from (9,19) to (19,9) + arrowhead */}
        <path d="M9 19 L19 9" stroke="#17181C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.5 9 H19 V14.5" stroke="#17181C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "#17181C",
          lineHeight: 1,
        }}
      >
        xPay
      </span>
    </span>
  );
}
