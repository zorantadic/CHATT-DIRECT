import React from "react";

export default function StatusPill({ children, tone = "warn" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
