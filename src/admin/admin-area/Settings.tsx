"use client";
// Settings → Business, Notifications and Connections.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, useData } from "@/admin/api";
import { useCan } from "@/admin/shell";
import { Btn, ErrorNote, Field, Icon, Input, Loading, PageHead, Panel, Pill, SaveBar, Select, SwitchRow, Tags, useToast, type Tone } from "@/admin/ui";
import type { IconName } from "@/admin/icons";

/** Loads a settings document into an editable copy with dirty tracking and a save call. */
export function useSettingsForm<T>(path: string, putPath = path) {
  const res = useData<T>(path);
  const [v, setV] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => {
    // Copy what was loaded into the form.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (res.data) setV(structuredClone(res.data));
  }, [res.data]);
  const dirty = !!v && JSON.stringify(v) !== JSON.stringify(res.data);
  async function save(body: unknown = v, msg = "Saved") {
    setBusy(true); setErr(null);
    try {
      const out = await api.put<T>(putPath, body);
      res.setData(out);
      toast(msg);
      return out;
    } catch (e) {
      setErr((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { v, setV, dirty, busy, err, setErr, save, loadError: res.error, reset: () => res.data && setV(structuredClone(res.data)), reload: res.reload };
}

/* ---------- business ---------- */

type Business = {
  company_name: string; legal_name: string; slogan: string; phone: string; whatsapp: string; email: string; website: string; address: string;
  dts_licence: string; iata_number: string; ntn: string; currency: string; timezone: string; website_theme: string;
  social: { facebook: string; instagram: string; youtube: string; tiktok: string; linkedin: string; x: string };
};

export function BusinessTab() {
  const f = useSettingsForm<Business>("/settings/business");
  const canEdit = useCan("settings.business", "edit");
  if (f.loadError) return <ErrorNote error={f.loadError} />;
  if (!f.v) return <Loading />;
  const b = f.v;
  const set = (p: Partial<Business>) => f.setV({ ...b, ...p });
  const txt = (k: keyof Business, label: string, hint?: string, cls?: string) => (
    <Field label={label} hint={hint} className={cls}><Input value={String(b[k] ?? "")} onChange={(e) => set({ [k]: e.target.value } as Partial<Business>)} /></Field>
  );
  return (
    <>
      <PageHead eyebrow="Settings" title="Business" sub="Business details used on the website, vouchers and invoices.">
        {canEdit && <Btn variant="gold" icon="check" busy={f.busy} disabled={!f.dirty} onClick={() => f.save()}>Save</Btn>}
      </PageHead>
      <ErrorNote error={f.err} />
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="grid g-2" style={{ alignItems: "start" }}>
          <Panel title="Business">
            <div className="f-grid">
              {txt("company_name", "Trading name")}{txt("legal_name", "Legal name")}
              {txt("phone", "Phone")}{txt("whatsapp", "WhatsApp")}
              {txt("email", "Email")}{txt("website", "Website")}
              {txt("dts_licence", "DTS licence no.", "Department of Tourist Services")}{txt("iata_number", "IATA number", "If accredited")}
              {txt("ntn", "NTN", "National Tax Number")}{txt("slogan", "Slogan")}
              {txt("address", "Office address", undefined, "span-all")}
            </div>
          </Panel>
          <div className="grid" style={{ alignContent: "start" }}>
            <Panel title="Defaults">
              <div className="f-grid">
                <Field label="Currency"><Select value={b.currency} onChange={(e) => set({ currency: e.target.value })} options={["PKR", "AED", "SAR", "USD", "GBP", "EUR"]} /></Field>
                <Field label="Time zone"><Select value={b.timezone} onChange={(e) => set({ timezone: e.target.value })} options={["Asia/Karachi", "Asia/Riyadh", "Asia/Dubai", "Europe/London"]} /></Field>
                <Field label="Website theme" className="span-all">
                  <Select value={b.website_theme} onChange={(e) => set({ website_theme: e.target.value })} options={[{ value: "system", label: "Follow device" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
                </Field>
              </div>
            </Panel>
            <Panel title="Social links">
              <div className="f-grid">
                {(["facebook", "instagram", "youtube", "tiktok", "linkedin", "x"] as const).map((k) => (
                  <Field key={k} label={k === "x" ? "X (Twitter)" : k[0].toUpperCase() + k.slice(1)}>
                    <Input value={b.social[k]} placeholder="https://" onChange={(e) => set({ social: { ...b.social, [k]: e.target.value } })} />
                  </Field>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </fieldset>
      {canEdit && <SaveBar dirty={f.dirty} busy={f.busy} onSave={() => f.save()} onReset={f.reset} />}
    </>
  );
}

/* ---------- notifications ---------- */

type EvKey = "new_booking" | "new_enquiry" | "slip_uploaded" | "payment_verified" | "cancellation";
type Notify = { events: Record<EvKey, { email: boolean; whatsapp: boolean }>; emails: string[]; whatsapp: string[]; daily_summary: boolean };
const EVENTS: [EvKey, string, string][] = [
  ["new_booking", "New booking", "A guest books on the website or staff add a booking"],
  ["new_enquiry", "New enquiry", "Someone sends an enquiry from the website"],
  ["slip_uploaded", "Slip uploaded for verification", "A guest uploads a bank transfer slip"],
  ["payment_verified", "Payment received or verified", "A card payment succeeds or a slip is verified"],
  ["cancellation", "Booking cancelled", "A booking is cancelled by staff or the guest"],
];

export function NotificationsTab() {
  const f = useSettingsForm<Notify>("/settings/notifications");
  const canEdit = useCan("settings.notifications", "edit");
  if (f.loadError) return <ErrorNote error={f.loadError} />;
  if (!f.v) return <Loading />;
  const n = f.v;
  const setEv = (k: EvKey, ch: "email" | "whatsapp", on: boolean) => f.setV({ ...n, events: { ...n.events, [k]: { ...n.events[k], [ch]: on } } });
  return (
    <>
      <PageHead eyebrow="Settings" title="Notifications" sub="Choose what the team is told about, and who hears it.">
        {canEdit && <Btn variant="gold" icon="check" busy={f.busy} disabled={!f.dirty} onClick={() => f.save()}>Save</Btn>}
      </PageHead>
      <ErrorNote error={f.err} />
      <div className="grid g-ov" style={{ alignItems: "start" }}>
        <Panel title="Events">
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>When</th><th style={{ textAlign: "center" }}>Email</th><th style={{ textAlign: "center" }}>WhatsApp</th></tr></thead>
              <tbody>
                {EVENTS.map(([k, t, sub]) => (
                  <tr key={k}>
                    <td style={{ whiteSpace: "normal" }}><b>{t}</b><div className="faint" style={{ fontSize: 12 }}>{sub}</div></td>
                    <td style={{ textAlign: "center" }}><SwitchInline on={n.events[k].email} label={`${t} by email`} disabled={!canEdit} onChange={(v) => setEv(k, "email", v)} /></td>
                    <td style={{ textAlign: "center" }}><SwitchInline on={n.events[k].whatsapp} label={`${t} by WhatsApp`} disabled={!canEdit} onChange={(v) => setEv(k, "whatsapp", v)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SwitchRow title="Daily summary at 9:00" sub="One email each morning with yesterday’s bookings, payments and enquiries" checked={n.daily_summary} disabled={!canEdit} onChange={(v) => f.setV({ ...n, daily_summary: v })} />
        </Panel>
        <Panel title="Who gets them">
          <div className="grid">
            <Field label="Email recipients" hint="Type an address and press Enter"><Tags value={n.emails} onChange={(v) => f.setV({ ...n, emails: v })} placeholder="name@skyholidays.pk" /></Field>
            <Field label="WhatsApp numbers" hint="Messages go out once WhatsApp Business is connected"><Tags value={n.whatsapp} onChange={(v) => f.setV({ ...n, whatsapp: v })} placeholder="+92 3xx xxxxxxx" /></Field>
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Emails use the “Team alert” template under <Link href="/admin/settings/email">Settings → Email</Link>.</p>
          </div>
        </Panel>
      </div>
      {canEdit && <SaveBar dirty={f.dirty} busy={f.busy} onSave={() => f.save()} onReset={f.reset} />}
    </>
  );
}

function SwitchInline({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <button type="button" className="sw" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} />;
}

/* ---------- connections ---------- */

type Conn = { key: string; name: string; status: "ok" | "warn" | "bad" | "off"; detail: string; ms?: number };
const CONN_ICON: Record<string, IconName> = { postgres: "grid", redis: "refresh", email: "mail", gateway: "card", flights: "plane", otm: "compass" };
const CONN_TONE: Record<Conn["status"], [Tone, string]> = { ok: ["good", "Connected"], warn: ["warn", "Needs attention"], bad: ["bad", "Not working"], off: ["plain", "Not connected"] };
const CONN_LINK: Record<string, [string, string]> = { email: ["/admin/settings/email", "Open"], gateway: ["/admin/payments/methods", "Open"] };

export function ConnectionsTab() {
  const c = useData<Conn[]>("/settings/connections");
  return (
    <>
      <PageHead eyebrow="Settings" title="Connections" sub="Outside services the system talks to. Each one is checked live when you open this page.">
        <Btn icon="refresh" busy={c.loading} onClick={c.reload}>Check again</Btn>
      </PageHead>
      <ErrorNote error={c.error} />
      <Panel className="" >
        {!c.data ? <Loading label="Checking connections…" /> : (
          <div className="list">
            {c.data.map((x) => {
              const [tone, label] = CONN_TONE[x.status];
              const link = CONN_LINK[x.key];
              return (
                <div className="li" key={x.key}>
                  <div className="conn-ic"><Icon name={CONN_ICON[x.key] ?? "globe"} /></div>
                  <div className="grow">
                    <b style={{ fontSize: 13.5 }}>{x.name}</b>
                    <div className="t2" style={{ whiteSpace: "normal" }}>{x.detail}{x.ms != null && <span className="faint"> · {x.ms} ms</span>}</div>
                  </div>
                  <Pill tone={tone}>{label}</Pill>
                  {link && <Link className="btn btn-sm" href={link[0]}>{link[1]}</Link>}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
