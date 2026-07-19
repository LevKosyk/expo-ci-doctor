"use client";
import { useState } from "react";

export function Command({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1400); }
  return <div className="command"><code><span>$</span> {value}</code><button onClick={copy} aria-label="Copy command">{copied ? "Copied" : "Copy"}</button></div>;
}
