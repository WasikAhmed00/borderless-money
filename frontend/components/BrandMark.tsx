import * as React from "react";

export default function BrandMark() {
  const [failed, setFailed] = React.useState(false);
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="xPay">
      {!failed ? (
        <img
          src="/assets/xpay-logo.png"
          alt="xPay"
          width={32}
          height={32}
          className="h-8 w-8 rounded-lg object-contain"
          onError={() => setFailed(true)}
        />
      ) : null}
      <span
        style={{
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "#0C2340",
          lineHeight: 1,
        }}
      >
        xPay
      </span>
    </span>
  );
}
