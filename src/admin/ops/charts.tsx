"use client";
// Revenue area chart and service donut for the Overview (SVG, theme tokens only).
import { useId } from "react";

const short = (v: number) => (v >= 1e6 ? `${+(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : `${Math.round(v)}`);

function niceTop(max: number) {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 4, 6, 8, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

export function AreaChart({ points, label }: { points: { label: string; v: number }[]; label: string }) {
  const id = useId().replace(/:/g, "");
  const W = 640, H = 220, L = 44, R = 12, T = 12, B = 28;
  const n = points.length;
  const top = niceTop(Math.max(...points.map((p) => p.v), 0) * 1.1);
  const x = (i: number) => L + (n > 1 ? i * ((W - L - R) / (n - 1)) : 0);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const d = points.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.v).toFixed(1)).join(" ");
  const li = n - 1;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  const xi = n <= 1 ? [0] : [0, Math.round(li / 4), Math.round(li / 2), Math.round((3 * li) / 4), li];
  const last = points[li]?.v ?? 0;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label={label}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--gold)" stopOpacity=".38" /><stop offset="1" stopColor="var(--gold)" stopOpacity="0" /></linearGradient></defs>
      {ticks.map((v) => (
        <g key={v}>
          <line className="gl" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text x={L - 8} y={y(v) + 3.5} textAnchor="end">{v ? short(v) : "0"}</text>
        </g>
      ))}
      {[...new Set(xi)].map((i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor={i === li ? "end" : i ? "middle" : "start"}>{points[i]?.label}</text>
      ))}
      {n > 1 && <path d={`${d} L${x(li)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinejoin="round" />
      <line x1={x(li)} x2={x(li)} y1={y(last)} y2={y(0)} stroke="var(--gold)" strokeDasharray="3 3" opacity=".6" />
      <circle cx={x(li)} cy={y(last)} r="9" fill="var(--gold)" opacity=".18" />
      <circle cx={x(li)} cy={y(last)} r="4.5" fill="var(--gold)" />
      <text x={x(li) - 12} y={Math.min(y(last) + 22, H - B - 6)} textAnchor="end" style={{ fill: "var(--text)", fontWeight: 700, fontSize: 12 }}>PKR {short(last)} {points[li]?.label === "Today" ? "today" : "this month"}</text>
    </svg>
  );
}

export const MIX_COLORS = ["var(--gold)", "var(--signal)", "var(--good)", "var(--bad)", "var(--warn)", "var(--muted)"];

export function Donut({ parts, center, caption }: { parts: { label: string; value: number }[]; center: string; caption: string }) {
  const r = 52, c = 2 * Math.PI * r;
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const offs = parts.map((_, i) => parts.slice(0, i).reduce((a, p) => a + (p.value / total) * c, 0));
  return (
    <svg viewBox="0 0 140 140" style={{ width: 140, height: 140, flex: "none" }} role="img" aria-label={`Share by service: ${parts.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(", ")}`}>
      <circle r={r} cx="70" cy="70" fill="none" stroke="var(--line)" strokeWidth="16" />
      {parts.map((p, i) => {
        const len = (p.value / total) * c;
        const off = offs[i];
        return <circle key={p.label} r={r} cx="70" cy="70" fill="none" stroke={MIX_COLORS[i % MIX_COLORS.length]} strokeWidth="16"
          strokeDasharray={`${Math.max(len - (parts.length > 1 ? 3 : 0), 0)} ${c - len + (parts.length > 1 ? 3 : 0)}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" />;
      })}
      <text x="70" y="66" textAnchor="middle" style={{ fill: "var(--muted)", fontSize: 10, letterSpacing: ".12em" }}>{caption.toUpperCase()}</text>
      <text x="70" y="86" textAnchor="middle" style={{ fill: "var(--text)", fontFamily: "var(--body)", fontSize: 20, fontWeight: 700 }}>{center}</text>
    </svg>
  );
}
