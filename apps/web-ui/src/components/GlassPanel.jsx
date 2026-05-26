import React from "react";

export default function GlassPanel({ as: Component = "section", children, className = "", ...props }) {
  return (
    <Component className={`glassPanel${className ? ` ${className}` : ""}`} {...props}>
      {children}
    </Component>
  );
}
