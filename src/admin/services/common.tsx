"use client";
// Small pieces shared by the services pages (packages, Umrah, transfers, car rental, destinations, visa).
import { useCallback, useState, type ReactNode } from "react";
import { api } from "../api";
import { fmt } from "../format";
import { Guard } from "../shell";
import { tabOf } from "../section-index";
import { cx, Empty, IconBtn, Input, PreInput, Switch, useConfirm, useToast } from "../ui";

/** Validates the [tab] segment and guards it with "<section>.<tab>:view". */
export function TabPage({ section, tab, children }: { section: string; tab: string; children: (label: string) => ReactNode }) {
  const t = tabOf(section, tab);
  if (!t) return <Empty title="This page doesn’t exist" />;
  return <Guard perm={`${section}.${tab}`}>{children(t.label)}</Guard>;
}

/** Form state with a typed setter per field. */
export function useForm<T extends object>(initial: T) {
  const [f, setF] = useState<T>(initial);
  const set = useCallback(<K extends keyof T>(k: K) => (v: T[K]) => setF((x) => ({ ...x, [k]: v })), []);
  return { f, setF, set };
}

/** Numbers kept as strings while typing; "" means empty. */
export const numStr = (v: number | null | undefined) => (v == null ? "" : String(v));
export const toNum = (v: string) => (v.trim() === "" ? null : Number(v.replace(/,/g, "")));

export function NumInput({ value, onChange, pre, placeholder, min = 0, step, ...rest }: { value: string; onChange: (v: string) => void; pre?: ReactNode; placeholder?: string; min?: number; step?: number | string; "aria-label"?: string; id?: string }) {
  const p = { type: "number", inputMode: "decimal" as const, min, step: step ?? "any", value, placeholder, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value), ...rest };
  return pre ? <PreInput pre={pre} {...p} /> : <Input {...p} />;
}

/** Runs a save/delete call with a toast and a busy flag. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    setBusy(true);
    try {
      const out = await fn();
      if (ok) toast(ok);
      return out;
    } catch (e) {
      toast((e as Error).message, "bad");
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [toast]);
  return { busy, run };
}

/** Confirm, then DELETE; returns true when deleted. */
export function useDelete() {
  const confirm = useConfirm();
  const toast = useToast();
  return useCallback(async (path: string, what: string, body?: ReactNode) => {
    const ok = await confirm({ title: `Delete ${what}?`, body: body ?? "This can’t be undone.", confirm: "Delete", danger: true });
    if (!ok) return false;
    try {
      await api.del(path);
      toast("Deleted");
      return true;
    } catch (e) {
      toast((e as Error).message, "bad");
      return false;
    }
  }, [confirm, toast]);
}

/** A switch in a table cell that PATCHes one field and updates the row in place. */
export function LiveSwitch({ on, label, path, field, disabled, onDone }: { on: boolean; label: string; path: string; field: string; disabled?: boolean; onDone: (v: boolean) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Switch
        checked={on}
        label={label}
        disabled={disabled || busy}
        onChange={async (v) => {
          setBusy(true);
          onDone(v);
          try {
            await api.patch(path, { [field]: v });
            toast(v ? `${label}: on` : `${label}: off`);
          } catch (e) {
            onDone(!v);
            toast((e as Error).message, "bad");
          } finally {
            setBusy(false);
          }
        }}
      />
    </span>
  );
}

/** Seats bar from the design: one tick per seat, filled when sold. */
export function Seats({ sold, total }: { sold: number; total: number }) {
  const shown = Math.min(total, 60);
  const filled = total ? Math.round((sold / total) * shown) : 0;
  return (
    <>
      <div className="seats" role="img" aria-label={`${sold} of ${total} seats sold`}>
        {Array.from({ length: shown }, (_, i) => <i key={i} className={i < filled ? "" : "f"} />)}
      </div>
      <div className="t2 tab">{sold} of {total} · {Math.max(0, total - sold)} left</div>
    </>
  );
}

/** Up / down buttons for ordered lists. */
export function OrderBtns({ i, n, onMove, disabled }: { i: number; n: number; onMove: (from: number, to: number) => void; disabled?: boolean }) {
  return (
    <span className="row svc-ord" style={{ gap: 2, flexWrap: "nowrap" }} onClick={(e) => e.stopPropagation()}>
      <IconBtn icon="back" label="Move up" disabled={disabled || i === 0} onClick={() => onMove(i, i - 1)} />
      <IconBtn icon="chev" label="Move down" disabled={disabled || i === n - 1} onClick={() => onMove(i, i + 1)} />
    </span>
  );
}

export function move<T>(list: T[], from: number, to: number): T[] {
  const out = [...list];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

/** Table cell price: "–" for none. */
export const cellPrice = (v: number | null | undefined) => (v ? fmt(v) : "–");

export const duration = (min: number | null | undefined) => {
  if (!min) return "–";
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
};

/** Clickable table row: Enter/Space opens it too. */
export const rowProps = (open: () => void) => ({
  className: "click",
  tabIndex: 0,
  onClick: open,
  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } },
});

/** Little sub-heading inside drawers. */
export function SubHead({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return <div className={cx("row", "svc-sub")}><h3 style={{ flex: 1, margin: 0 }}>{children}</h3>{actions}</div>;
}

/** Day/evening photo pair as CSS variables; .svc-pic shows the one for the current theme. */
export const picVars = (p: { image_day_url?: string | null; image_night_url?: string | null }) => {
  const d = p.image_day_url || p.image_night_url, n = p.image_night_url || p.image_day_url;
  return { "--pd": d ? `url("${d}")` : "none", "--pn": n ? `url("${n}")` : "none" } as React.CSSProperties;
};

/** "YYYY-MM-DD" n days from today. */
export const isoInDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
