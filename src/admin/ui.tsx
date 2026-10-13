"use client";
// Building blocks for every dashboard page, matching the approved control-deck design.
// Class names come from src/app/admin/admin.css.
import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import type { IconName } from "./icons";
import { uploadFile } from "./api";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return <svg className={cx("i", className)} aria-hidden="true"><use href={`#i-${name}`} /></svg>;
}

/* ---------- page structure ---------- */

export function PageHead({ eyebrow, title, sub, children }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="ph">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

export function Panel({ title, label, actions, children, className, id }: { title?: ReactNode; label?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; id?: string }) {
  return (
    <section className={cx("panel", className)} id={id}>
      {(title || label || actions) && (
        <div className="panel-h">
          {label && <span className="lbl">{label}</span>}
          {title && <h2>{title}</h2>}
          <span className="spacer" />
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Editor section with the numbered gold icon header (hotel / excursion editors, settings). */
export function Section({ id, icon, title, sub, children, actions }: { id?: string; icon: IconName; title: string; sub?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="panel sec" id={id}>
      <div className="sec-h">
        <div className="ix"><Icon name={icon} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="loading"><span className="spin" />{label}</div>;
}

export function ErrorNote({ error }: { error: string | null | undefined }) {
  return error ? <div className="err" role="alert">{error}</div> : null;
}

export function Empty({ icon = "spark", title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <b style={{ color: "var(--text)" }}>{title}</b>
      {children}
    </div>
  );
}

/* ---------- buttons, pills ---------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "gold" | "ghost" | "danger" | "plain"; size?: "sm" | "md"; icon?: IconName; busy?: boolean };
export function Btn({ variant = "plain", size = "md", icon, busy, children, className, disabled, type = "button", ...rest }: BtnProps) {
  return (
    <button
      type={type}
      className={cx("btn", variant !== "plain" && `btn-${variant}`, size === "sm" && "btn-sm", className)}
      disabled={disabled || busy}
      {...rest}
    >
      {busy ? <span className="spin" /> : icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function IconBtn({ icon, label, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return <button type="button" className="icon-btn" aria-label={label} title={label} {...rest}><Icon name={icon} /></button>;
}

export type Tone = "good" | "warn" | "bad" | "info" | "sig" | "gold" | "plain";
export function Pill({ tone = "plain", dot = true, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return <span className={cx("pill", tone !== "plain" && `p-${tone}`, !dot && "nodot")}>{children}</span>;
}

/* ---------- form controls ---------- */

export function Field({ label, hint, children, className, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cx("fld", className)}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx("inp", className)} {...rest} />;
}

/** Input with a prefix tag such as "PKR" or "%". */
export function PreInput({ pre, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { pre: ReactNode }) {
  return (
    <div className={cx("inp-pre", className)}>
      <span>{pre}</span>
      <input {...rest} />
    </div>
  );
}

export type Opt = string | { value: string; label: string };
export function Select({ options, className, placeholder, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { options: Opt[]; placeholder?: string }) {
  return (
    <select className={cx("inp", className)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        return <option key={v} value={v}>{typeof o === "string" ? o : o.label}</option>;
      })}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx("inp", className)} {...rest} />;
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="sw"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

/** A labelled row with a switch on the right (settings lists). */
export function SwitchRow({ title, sub, checked, onChange, disabled }: { title: ReactNode; sub?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="sw-row">
      <div>
        <b style={{ fontSize: 13.5 }}>{title}</b>
        {sub && <div className="t2">{sub}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} label={typeof title === "string" ? title : "Toggle"} disabled={disabled} />
    </div>
  );
}

export function Check({ label, checked, onChange, indeterminate, disabled }: { label?: ReactNode; checked: boolean; onChange: (v: boolean) => void; indeterminate?: boolean; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <label className="cbx">
      <input ref={ref} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={typeof label === "string" ? label : undefined} />
      {label}
    </label>
  );
}

/** Free-text list editor: type and press Enter to add, × to remove. */
export function Tags({ value, onChange, placeholder = "Type and press Enter" }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="tagbox">
      {value.map((t) => (
        <span className="tag" key={t}>
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>×</button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={placeholder}
        aria-label="Add item"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
      />
    </div>
  );
}

export function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" className={i <= value ? "on" : ""} aria-label={`${i} star`} onClick={() => onChange?.(i === value ? 0 : i)} disabled={!onChange}>
          <svg><use href="#i-star" /></svg>
        </button>
      ))}
    </div>
  );
}

/** Image picker that uploads straight to the media library and returns the stored URL. */
export function ImageUpload({ value, onChange, folder = "general", label = "Upload image", hint, aspect = "3/2", contain }: {
  value: string | null | undefined; onChange: (url: string | null) => void; folder?: string; label?: string; hint?: string; aspect?: string; contain?: boolean;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true); setErr(null);
    try {
      const m = await uploadFile(f, folder);
      onChange(m.url);
      toast("Uploaded");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        htmlFor={id}
        className="drop"
        style={value ? { backgroundImage: `url("${value}")`, backgroundSize: contain ? "contain" : "cover", backgroundRepeat: "no-repeat", backgroundPosition: "center", aspectRatio: aspect, minHeight: 0, color: "transparent", cursor: "pointer" } : { aspectRatio: aspect, minHeight: 0, cursor: "pointer" }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
      >
        {!value && (busy ? <span className="spin" /> : <><Icon name="upload" /><span>{label}</span>{hint && <span className="hint">{hint}</span>}</>)}
      </label>
      <input id={id} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {value && (
        <div className="row">
          <label htmlFor={id} className="btn btn-sm"><Icon name="upload" />Replace</label>
          <Btn size="sm" variant="ghost" icon="trash" onClick={() => onChange(null)}>Remove</Btn>
          {busy && <span className="spin" />}
        </div>
      )}
      <ErrorNote error={err} />
    </div>
  );
}

/* ---------- overlays ---------- */

/** Right-side drawer (booking details, enquiry details). */
export function Drawer({ open, onClose, head, foot, children, label = "Details" }: { open: boolean; onClose: () => void; head: ReactNode; foot?: ReactNode; children: ReactNode; label?: string }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <>
      <div className={cx("scrim", open && "on")} onClick={onClose} />
      <aside className={cx("drawer", open && "on")} aria-label={label} aria-hidden={!open}>
        {open && (
          <>
            <div className="dr-h">
              <div style={{ flex: 1, minWidth: 0 }}>{head}</div>
              <IconBtn icon="x" label="Close" onClick={onClose} />
            </div>
            <div className="dr-b">{children}</div>
            {foot && <div className="dr-f">{foot}</div>}
          </>
        )}
      </aside>
    </>
  );
}

export function Modal({ open, onClose, title, children, foot, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; foot?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx("modal-in", wide && "wide")} role="dialog" aria-modal="true">
        <div className="row"><h2 style={{ flex: 1 }}>{title}</h2><IconBtn icon="x" label="Close" onClick={onClose} /></div>
        {children}
        {foot && <div className="row" style={{ justifyContent: "flex-end" }}>{foot}</div>}
      </div>
    </div>
  );
}

/* ---------- toast + confirm ---------- */

type ToastFn = (msg: string, kind?: "ok" | "bad") => void;
const ToastCtx = createContext<ToastFn>(() => {});
type ConfirmFn = (o: { title: string; body?: ReactNode; confirm?: string; danger?: boolean }) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn>(async () => false);

export const useToast = () => useContext(ToastCtx);
export const useConfirm = () => useContext(ConfirmCtx);

export function Feedback({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; kind: "ok" | "bad"; on: boolean }>({ msg: "", kind: "ok", on: false });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback<ToastFn>((msg, kind = "ok") => {
    setT({ msg, kind, on: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT((x) => ({ ...x, on: false })), kind === "bad" ? 4200 : 2400);
  }, []);
  const [c, setC] = useState<null | (Parameters<ConfirmFn>[0] & { resolve: (v: boolean) => void })>(null);
  const confirm = useCallback<ConfirmFn>((o) => new Promise((resolve) => setC({ ...o, resolve })), []);
  const done = (v: boolean) => { c?.resolve(v); setC(null); };
  return (
    <ToastCtx.Provider value={toast}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        <div className={cx("toast", t.on && "on", t.kind === "bad" && "bad")} role="status" aria-live="polite">
          <Icon name={t.kind === "bad" ? "x" : "check"} /><span>{t.msg}</span>
        </div>
        <Modal open={!!c} onClose={() => done(false)} title={c?.title} foot={<>
          <Btn variant="ghost" onClick={() => done(false)}>Keep it</Btn>
          <Btn variant={c?.danger ? "danger" : "gold"} onClick={() => done(true)}>{c?.confirm ?? "Confirm"}</Btn>
        </>}>
          {c?.body && <div className="muted">{c.body}</div>}
        </Modal>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

/* ---------- data bits ---------- */

/** Small sparkline for KPI cards. */
export function Spark({ values, color = "var(--gold)" }: { values: number[]; color?: string }) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const w = 96, h = 34, mx = Math.max(...values), mn = Math.min(...values);
  const pts = values.map((v, i) => [i * (w / (values.length - 1)), h - 4 - ((v - mn) / (mx - mn || 1)) * (h - 8)]);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

export function Kpi({ label, icon, value, unit, delta, spark, color }: { label: string; icon?: IconName; value: ReactNode; unit?: string; delta?: ReactNode; spark?: number[]; color?: string }) {
  return (
    <div className="panel kpi">
      <div className="lbl">{icon && <Icon name={icon} className="i-sm" />}{label}</div>
      <div className="v tab">{unit && <small>{unit}</small>}{value}</div>
      {delta && <div className="d">{delta}</div>}
      {spark && <Spark values={spark} color={color} />}
    </div>
  );
}

/** Label/value grid used in drawers. */
export function KV({ items }: { items: [ReactNode, ReactNode][] }) {
  return <div className="kv">{items.map(([k, v], i) => <div key={i}><span>{k}</span><b>{v}</b></div>)}</div>;
}

export function Search({ value, onChange, placeholder = "Search" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="search-in">
      <Icon name="search" className="i-sm" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}

/** Sticky "unsaved changes" bar for editors. */
export function SaveBar({ dirty, busy, onSave, onReset, children }: { dirty: boolean; busy?: boolean; onSave: () => void; onReset?: () => void; children?: ReactNode }) {
  if (!dirty) return null;
  return (
    <div className="save-bar no-print">
      <span style={{ fontWeight: 700, flex: 1 }}>Unsaved changes</span>
      {children}
      {onReset && <Btn variant="ghost" size="sm" onClick={onReset}>Discard</Btn>}
      <Btn variant="gold" icon="check" busy={busy} onClick={onSave}>Save changes</Btn>
    </div>
  );
}
