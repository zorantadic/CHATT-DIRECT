import React from "react";

export default function ReadonlyField({ hint, label, value }) {
  return (
    <div className="readonlyField">
      <span className="readonlyLabel">{label}</span>
      <strong className="readonlyValue">{value}</strong>
      {hint ? <span className="readonlyHint">{hint}</span> : null}
    </div>
  );
}
