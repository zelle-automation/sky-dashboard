"use client";
// Payments area: checkout methods (each with an on/off switch), the transactions ledger,
// slips to verify, refunds, and checkout rules.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api, useData } from "../api";
import { dateTime, fmt, pkr } from "../format";
import { useCan } from "../shell";
import { Btn, ErrorNote, Field, Icon, IconBtn, Input, Loading, Modal, PageHead, Panel, Pill, PreInput, SaveBar, Search, Select, Switch, SwitchRow, cx, useConfirm, useToast, type Tone } from "../ui";
import type { IconName } from "../icons";
import { BookingDrawer } from "./booking-drawer";
import { SlipModal, type SlipPayment } from "./booking-forms";
import { METHODS, methodLabel } from "./status";

const PRODUCTS: [string, string][] = [["hotel", "Hotels"], ["excursion", "Excursions"], ["package", "Packages"], ["umrah", "Umrah"], ["transfer", "Transfers"], ["car", "Car rental"], ["visa", "Visa"]];
const BRAND: Record<string, string> = {
  meezan: "#0F6B4F", hbl: "#00826B", ubl: "#0055A5", mcb: "#00703C", "bank alfalah": "#C8102E", "allied bank": "#1B3E8F", "faysal bank": "#0E7A3B", "standard chartered": "#0072AA",
  jazzcash: "#D7182A", easypaisa: "#2BB24C", sadapay: "#FF6A5B", visa: "#1A1F71", mastercard: "#EB001B", unionpay: "#00508F", paypak: "#0B8A3E", amex: "#2E77BB",
};
const brandColor = (name: string) => Object.entries(BRAND).find(([k]) => name.toLowerCase().includes(k))?.[1] ?? "var(--gold)";
const abbr = (name: string) => {
  const words = name.replace(/\bbank\b/i, "").trim().split(/\s+/).filter(Boolean);
  if (/meezan/i.test(name)) return "MZN";
  return (words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? name)).slice(0, 4).toUpperCase();
};

function OfferFor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="fld">
      <span className="lab">Offer for</span>
      <div className="chips">
        {PRODUCTS.map(([k, l]) => (
          <button key={k} type="button" className="chip" aria-pressed={value.includes(k)} onClick={() => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k])}>{l}</button>
        ))}
      </div>
    </div>
  );
}

/* ---------- methods ---------- */

type Wallet = { enabled: boolean; account: string; limit: number; window_minutes: number };
type Methods = {
  bank: { enabled: boolean; offer_for: string[]; config: { require_slip: boolean; raast_enabled: boolean; hold_hours: number; verify_within: string } };
  card: { enabled: boolean; offer_for: string[]; secrets_set: Record<string, boolean>; config: { gateway: string; merchant_id: string; surcharge_pct: number; mode: "test" | "live"; brands: Record<"visa" | "mastercard" | "unionpay" | "paypak" | "amex", boolean>; three_d_secure: boolean; international: boolean } };
  wallet: { enabled: boolean; offer_for: string[]; secrets_set: Record<string, boolean>; config: { wallets: Record<"jazzcash" | "easypaisa" | "sadapay", Wallet> } };
  cash: { enabled: boolean; offer_for: string[]; config: { office: string; pay_within_hours: number } };
};
type Account = { id?: string; key: string; bank_name: string; account_title: string; account_no: string; iban: string; raast_id: string; branch: string; enabled: boolean };
type MethodsData = { methods: Methods; accounts: (Omit<Account, "key"> & { id: string })[] };
type State = { m: Methods; accounts: Account[]; secrets: Record<string, string> };

const toState = (d: MethodsData): State => ({
  m: JSON.parse(JSON.stringify(d.methods)),
  accounts: d.accounts.map((a) => ({ ...a, key: a.id, account_no: a.account_no ?? "", iban: a.iban ?? "", raast_id: a.raast_id ?? "", branch: a.branch ?? "" })),
  secrets: {},
});

function MethodHead({ icon, title, sub, on, onChange, disabled }: { icon: IconName; title: string; sub: string; on: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <div className="pm-top">
      <div className="pm-ic"><Icon name={icon} /></div>
      <div className="ops-pm-tx"><h2 style={{ fontSize: 21 }}>{title}</h2><div style={{ color: "var(--muted)", fontSize: 12.5 }}>{sub}</div></div>
      <Pill tone={on ? "good" : "plain"} dot={on}>{on ? "Live at checkout" : "Hidden at checkout"}</Pill>
      <Switch checked={on} onChange={onChange} label={`${title} enabled`} disabled={disabled} />
    </div>
  );
}

function SecretInput({ label, name, set, value, onChange, disabled }: { label: string; name: string; set: boolean; value: string | undefined; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <Field label={label} hint={set ? "Saved and encrypted. Type a new value to replace it." : "Stored encrypted. Never shown again after saving."}>
      <Input type="password" autoComplete="new-password" name={name} disabled={disabled} value={value ?? ""} placeholder={set ? "•••••••• saved" : "Not set"} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function MethodsTab() {
  const { data, error, setData } = useData<MethodsData>("/payments/methods");
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const canEdit = useCan("payments.methods", "edit");
  const toast = useToast();

  useEffect(() => {
    // Copy the saved settings into the editable form when they (re)load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data) setS(toState(data));
  }, [data]);
  const dirty = useMemo(() => !!(s && data && JSON.stringify(s) !== JSON.stringify(toState(data))), [s, data]);

  if (error) return <ErrorNote error={error} />;
  if (!s) return <Loading />;
  const m = s.m;
  const up = <K extends keyof Methods>(k: K, v: Partial<Methods[K]>) => setS({ ...s, m: { ...m, [k]: { ...m[k], ...v } } });
  const cfg = <K extends keyof Methods>(k: K, v: Partial<Methods[K]["config"]>) => up(k, { config: { ...m[k].config, ...v } } as Partial<Methods[K]>);
  const sec = (k: string, v: string) => setS({ ...s, secrets: { ...s.secrets, [k]: v } });
  const acc = (key: string, v: Partial<Account>) => setS({ ...s, accounts: s.accounts.map((a) => (a.key === key ? { ...a, ...v } : a)) });
  const ro = !canEdit;

  async function save() {
    if (!s) return;
    setBusy(true); setErr(null);
    const pick = (keys: string[]) => Object.fromEntries(keys.filter((k) => s.secrets[k]?.trim()).map((k) => [k, s.secrets[k]]));
    try {
      const d = await api.put<MethodsData>("/payments/methods", {
        bank: { enabled: m.bank.enabled, offer_for: m.bank.offer_for, config: m.bank.config },
        card: { enabled: m.card.enabled, offer_for: m.card.offer_for, config: m.card.config, secrets: pick(["api_key", "secret_key"]) },
        wallet: { enabled: m.wallet.enabled, offer_for: m.wallet.offer_for, config: m.wallet.config, secrets: pick(["jazzcash_key", "easypaisa_key", "sadapay_key"]) },
        cash: { enabled: m.cash.enabled, offer_for: m.cash.offer_for, config: m.cash.config },
        accounts: s.accounts.map(({ key: _key, ...a }) => a), // eslint-disable-line @typescript-eslint/no-unused-vars
      });
      setData(d); setEditing(null);
      toast("Payment methods saved");
    } catch (e) { setErr((e as Error).message); toast((e as Error).message, "bad"); } finally { setBusy(false); }
  }

  const W: [keyof Methods["wallet"]["config"]["wallets"], string][] = [["jazzcash", "JazzCash"], ["easypaisa", "Easypaisa"], ["sadapay", "SadaPay"]];

  return (
    <>
      <PageHead eyebrow="Payments" title="Payment methods" sub="Turn each payment method on or off. Guests only see the methods that are switched on, and only for the products you pick.">
        {canEdit && <Btn variant="gold" icon="check" busy={busy} disabled={!dirty} onClick={save}>Save changes</Btn>}
      </PageHead>
      <ErrorNote error={err} />
      <div className="grid g-2" style={{ alignItems: "start" }}>
        <div className={cx("panel", "pm", !m.bank.enabled && "off")}>
          <MethodHead icon="bank" title="Bank transfer" sub="Guest pays into your account and uploads the slip" on={m.bank.enabled} onChange={(v) => up("bank", { enabled: v })} disabled={ro} />
          <div className="pm-body">
            {s.accounts.map((a) => editing === a.key ? (
              <div key={a.key} className="sub-m" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div className="f-grid">
                  <Field label="Bank"><Input value={a.bank_name} onChange={(e) => acc(a.key, { bank_name: e.target.value })} placeholder="Meezan Bank" /></Field>
                  <Field label="Account title"><Input value={a.account_title} onChange={(e) => acc(a.key, { account_title: e.target.value })} /></Field>
                  <Field label="Account number"><Input value={a.account_no} onChange={(e) => acc(a.key, { account_no: e.target.value })} /></Field>
                  <Field label="IBAN"><Input value={a.iban} onChange={(e) => acc(a.key, { iban: e.target.value.toUpperCase() })} placeholder="PK36 MEZN 0001 2345 6789 0123" /></Field>
                  <Field label="Raast ID"><Input value={a.raast_id} onChange={(e) => acc(a.key, { raast_id: e.target.value })} placeholder="Mobile number or alias" /></Field>
                  <Field label="Branch"><Input value={a.branch} onChange={(e) => acc(a.key, { branch: e.target.value })} /></Field>
                </div>
                <div className="row" style={{ justifyContent: "flex-end" }}><Btn size="sm" onClick={() => setEditing(null)}>Done</Btn></div>
              </div>
            ) : (
              <div key={a.key} className="sub-m">
                <div className="logo-chip" style={{ background: brandColor(a.bank_name || "bank") }}>{abbr(a.bank_name || "Bank")}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 13 }}>{a.bank_name || "New account"}</b>
                  <div className="mono trunc" style={{ color: "var(--muted)" }}>{a.iban ? a.iban.replace(/(.{4})/g, "$1 ").trim() : a.account_no || "No IBAN yet"}</div>
                  <div className="t2 trunc" style={{ fontSize: 11.5, color: "var(--faint)" }}>{a.account_title}{a.raast_id ? ` · Raast ${a.raast_id}` : ""}</div>
                </div>
                {canEdit && <IconBtn icon="edit" label={`Edit ${a.bank_name}`} onClick={() => setEditing(a.key)} />}
                {canEdit && <IconBtn icon="trash" label={`Remove ${a.bank_name}`} onClick={() => setS({ ...s, accounts: s.accounts.filter((x) => x.key !== a.key) })} />}
                <Switch checked={a.enabled} onChange={(v) => acc(a.key, { enabled: v })} label={`${a.bank_name} shown at checkout`} disabled={ro} />
              </div>
            ))}
            {canEdit && <Btn size="sm" variant="ghost" icon="plus" style={{ alignSelf: "flex-start" }} onClick={() => {
              const key = `new-${Date.now()}`;
              setS({ ...s, accounts: [...s.accounts, { key, bank_name: "", account_title: "Sky Holidays (Pvt) Ltd", account_no: "", iban: "", raast_id: "", branch: "", enabled: true }] });
              setEditing(key);
            }}>Add bank account</Btn>}
            <SwitchRow title="Raast instant payment" sub="Show your Raast ID for instant transfers" checked={m.bank.config.raast_enabled} onChange={(v) => cfg("bank", { raast_enabled: v })} disabled={ro} />
            <SwitchRow title="Require payment slip" sub="Guest must upload a screenshot or slip" checked={m.bank.config.require_slip} onChange={(v) => cfg("bank", { require_slip: v })} disabled={ro} />
            <div className="f-grid">
              <Field label="Hold unpaid booking for"><Select disabled={ro} value={String(m.bank.config.hold_hours)} onChange={(e) => cfg("bank", { hold_hours: Number(e.target.value) })} options={[12, 24, 48, 72].map((h) => ({ value: String(h), label: `${h} hours` }))} /></Field>
              <Field label="Verify slips within"><Select disabled={ro} value={m.bank.config.verify_within} onChange={(e) => cfg("bank", { verify_within: e.target.value })} options={["2 hours", "4 hours", "Same day", "Next working day"]} /></Field>
            </div>
            <OfferFor value={m.bank.offer_for} onChange={(v) => up("bank", { offer_for: v })} />
          </div>
        </div>

        <div className={cx("panel", "pm", !m.card.enabled && "off")}>
          <MethodHead icon="card" title="Debit / credit card" sub="Paid online with 3-D Secure" on={m.card.enabled} onChange={(v) => up("card", { enabled: v })} disabled={ro} />
          <div className="pm-body">
            <div className="f-grid">
              <Field label="Payment gateway"><Select disabled={ro} value={m.card.config.gateway} onChange={(e) => cfg("card", { gateway: e.target.value })} options={["Bank payment gateway", "Hosted checkout page", "Other provider"]} /></Field>
              <Field label="Merchant ID"><Input disabled={ro} value={m.card.config.merchant_id} onChange={(e) => cfg("card", { merchant_id: e.target.value })} /></Field>
              <Field label="Card surcharge" hint="Added at checkout, shown to the guest"><PreInput pre="%" disabled={ro} inputMode="decimal" value={String(m.card.config.surcharge_pct)} onChange={(e) => cfg("card", { surcharge_pct: Number(e.target.value) || 0 })} /></Field>
              <Field label="Mode"><Select disabled={ro} value={m.card.config.mode} onChange={(e) => cfg("card", { mode: e.target.value as "test" | "live" })} options={[{ value: "live", label: "Live" }, { value: "test", label: "Test" }]} /></Field>
              <SecretInput label="Gateway API key" name="card-api" set={!!m.card.secrets_set?.api_key} value={s.secrets.api_key} onChange={(v) => sec("api_key", v)} disabled={ro} />
              <SecretInput label="Gateway secret" name="card-secret" set={!!m.card.secrets_set?.secret_key} value={s.secrets.secret_key} onChange={(v) => sec("secret_key", v)} disabled={ro} />
            </div>
            <div className="fld">
              <span className="lab">Accepted cards</span>
              <div className="row">
                {([["visa", "VISA"], ["mastercard", "Mastercard"], ["unionpay", "UnionPay"], ["paypak", "PayPak"], ["amex", "Amex"]] as const).map(([k, n]) => (
                  <div key={k} className="sub-m" style={{ padding: "8px 10px", gap: 8 }}>
                    <div className="logo-chip" style={{ background: brandColor(k), width: 30, height: 22, borderRadius: 5, fontSize: 7.5 }}>{n.slice(0, 4).toUpperCase()}</div>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{n}</span>
                    <Switch checked={m.card.config.brands[k]} onChange={(v) => cfg("card", { brands: { ...m.card.config.brands, [k]: v } })} label={n} disabled={ro} />
                  </div>
                ))}
              </div>
            </div>
            <SwitchRow title="Require 3-D Secure" sub="One-time code from the guest’s bank" checked={m.card.config.three_d_secure} onChange={(v) => cfg("card", { three_d_secure: v })} disabled={ro} />
            <SwitchRow title="Allow international cards" sub="Cards issued outside Pakistan" checked={m.card.config.international} onChange={(v) => cfg("card", { international: v })} disabled={ro} />
            <OfferFor value={m.card.offer_for} onChange={(v) => up("card", { offer_for: v })} />
          </div>
        </div>

        <div className={cx("panel", "pm", !m.wallet.enabled && "off")}>
          <MethodHead icon="phone" title="Mobile wallet" sub="Pay from a JazzCash, Easypaisa or SadaPay account" on={m.wallet.enabled} onChange={(v) => up("wallet", { enabled: v })} disabled={ro} />
          <div className="pm-body">
            {W.map(([k, n]) => {
              const w = m.wallet.config.wallets[k];
              const setW = (v: Partial<Wallet>) => cfg("wallet", { wallets: { ...m.wallet.config.wallets, [k]: { ...w, ...v } } });
              return (
                <div key={k} className="sub-m" style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <div className="logo-chip" style={{ background: brandColor(k) }}>{n.slice(0, 4)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 13 }}>{n}</b><div className="mono" style={{ color: "var(--muted)" }}>{w.account ? `Merchant ${w.account}` : "Not connected"}</div></div>
                    <Switch checked={w.enabled} onChange={(v) => setW({ enabled: v })} label={`${n} enabled`} disabled={ro} />
                  </div>
                  {w.enabled && (
                    <div className="f-grid c3">
                      <Field label="Merchant account"><Input disabled={ro} value={w.account} onChange={(e) => setW({ account: e.target.value })} /></Field>
                      <Field label="Limit per payment"><PreInput pre="PKR" disabled={ro} inputMode="decimal" value={fmt(w.limit)} onChange={(e) => setW({ limit: Number(e.target.value.replace(/,/g, "")) || 0 })} /></Field>
                      <Field label="Payment window"><Select disabled={ro} value={String(w.window_minutes)} onChange={(e) => setW({ window_minutes: Number(e.target.value) })} options={[15, 30, 60, 120].map((x) => ({ value: String(x), label: `${x} minutes` }))} /></Field>
                      <SecretInput label={`${n} API key`} name={`${k}-key`} set={!!m.wallet.secrets_set?.[`${k}_key`]} value={s.secrets[`${k}_key`]} onChange={(v) => sec(`${k}_key`, v)} disabled={ro} />
                    </div>
                  )}
                </div>
              );
            })}
            <div className="t2" style={{ color: "var(--muted)", fontSize: 12 }}>Wallet limits also apply to the guest’s own account.</div>
            <OfferFor value={m.wallet.offer_for} onChange={(v) => up("wallet", { offer_for: v })} />
          </div>
        </div>

        <div className={cx("panel", "pm", !m.cash.enabled && "off")}>
          <MethodHead icon="home" title="Cash at office" sub="Guest pays at the Sky Holidays office" on={m.cash.enabled} onChange={(v) => up("cash", { enabled: v })} disabled={ro} />
          <div className="pm-body">
            <div className="f-grid">
              <Field label="Office"><Input disabled={ro} value={m.cash.config.office} onChange={(e) => cfg("cash", { office: e.target.value })} /></Field>
              <Field label="Pay within"><Select disabled={ro} value={String(m.cash.config.pay_within_hours)} onChange={(e) => cfg("cash", { pay_within_hours: Number(e.target.value) })} options={[24, 48, 72].map((h) => ({ value: String(h), label: `${h} hours` }))} /></Field>
            </div>
            <OfferFor value={m.cash.offer_for} onChange={(v) => up("cash", { offer_for: v })} />
          </div>
        </div>
      </div>
      {canEdit && <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={() => data && setS(toState(data))} />}
    </>
  );
}

/* ---------- transactions / slips / refunds ---------- */

type Tx = {
  id: string; kind: "payment" | "refund"; method: string; provider: string | null; amount: number; currency_code: string; status: string; reference: string | null; slip_url: string | null;
  note: string | null; received_at: string; verified_at: string | null; paid_at: string | null; verified_by_name: string | null; booking_id: string; ref: string; lead_name: string;
  product_name: string; booking_status: string; total_amount: number; paid_amount: number;
};
type Awaiting = { id: string; ref: string; lead_name: string; product_name: string; paid_amount: number; total_amount: number; cancel_reason: string | null; cancelled_at: string | null; payment_method: string | null };

function txStatus(t: Tx): [string, Tone] {
  if (t.kind === "refund") return t.status === "verified" ? ["Refunded", "good"] : ["Refund pending", "bad"];
  if (t.status === "pending") return ["Slip to verify", "sig"];
  if (t.status === "verified") return [t.method === "card" || t.method === "wallet" ? "Succeeded" : "Verified", "good"];
  return [t.status === "rejected" ? "Rejected" : "Failed", "bad"];
}

const TITLES: Record<string, [string, string]> = {
  transactions: ["Transactions", "Every payment and refund across all bookings."],
  verify: ["Slips to verify", "Bank transfer slips uploaded by guests. Check each one against your bank statement, then verify it."],
  refunds: ["Refunds", "Money going back to guests after a cancellation. Mark each refund paid once it has left your account."],
};

export function LedgerTab({ tab }: { tab: "transactions" | "verify" | "refunds" }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [method, setMethod] = useState("");
  const [slip, setSlip] = useState<SlipPayment | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [refundFor, setRefundFor] = useState<Awaiting | null>(null);
  const [paying, setPaying] = useState<Tx | null>(null);
  const canEdit = useCan(`payments.${tab}`, "edit");
  const canVerifyTab = useCan("payments.verify", "edit");
  const canTx = useCan("payments.transactions", "edit");
  const canRefunds = useCan("payments.refunds", "edit");
  const canVerify = canVerifyTab || canTx;

  useEffect(() => {
    const id = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);
  const { data, error, reload } = useData<{ rows: Tx[]; awaiting: Awaiting[] }>(`/payments/transactions?tab=${tab}${term ? `&q=${encodeURIComponent(term)}` : ""}`);
  const rows = (data?.rows ?? []).filter((t) => !method || t.method === method);
  const [title, sub] = TITLES[tab];
  const pendingTotal = rows.filter((t) => t.status === "pending").reduce((s, t) => s + t.amount, 0);

  return (
    <>
      <PageHead eyebrow="Payments" title={title} sub={sub}>
        {tab !== "transactions" && rows.some((t) => t.status === "pending") && <Pill tone={tab === "verify" ? "sig" : "bad"}>{pkr(pendingTotal)} waiting</Pill>}
      </PageHead>
      <ErrorNote error={error} />
      {tab === "refunds" && !!data?.awaiting.length && (
        <Panel title="Cancelled, refund amount not set" className="ops-gap">
          <div className="list">
            {data.awaiting.map((b) => (
              <div key={b.id} className="li">
                <span className="pill p-bad nodot" style={{ padding: 8 }}><Icon name="refresh" /></span>
                <div className="grow"><b style={{ fontSize: 13 }}>{b.lead_name} · <button type="button" className="mono ops-link" onClick={() => setOpen(b.ref)}>{b.ref}</button></b><div className="t2 trunc">{b.product_name}{b.cancel_reason ? ` · ${b.cancel_reason}` : ""}</div></div>
                <span className="tab t2" style={{ whiteSpace: "nowrap" }}>Paid {pkr(b.paid_amount)}</span>
                {canEdit && <Btn size="sm" variant="gold" onClick={() => setRefundFor(b)}>Set up refund</Btn>}
              </div>
            ))}
          </div>
        </Panel>
      )}
      <div className="panel">
        <div className="row" style={{ marginBottom: 14 }}>
          <Search value={q} onChange={setQ} placeholder="Transaction or booking reference" />
          {tab === "transactions" && <Select aria-label="Method" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="All methods" options={METHODS.map(([value, label]) => ({ value, label }))} style={{ width: "auto" }} />}
        </div>
        {!data && !error ? <Loading /> : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Transaction</th><th>Booking</th><th>Method</th><th className="num">Amount</th><th>Status</th><th>{tab === "refunds" ? "Requested" : "Received"}</th><th /></tr></thead>
              <tbody>
                {rows.map((t) => {
                  const [label, tone] = txStatus(t);
                  return (
                    <tr key={t.id}>
                      <td><span className="mono">{t.reference ?? t.id.slice(0, 8).toUpperCase()}</span>{t.slip_url && <div className="t2"><a href={t.slip_url} target="_blank" rel="noreferrer" className="ops-link">View slip</a></div>}</td>
                      <td><button type="button" className="mono ops-link" onClick={() => setOpen(t.ref)}>{t.ref}</button><div className="t2">{t.lead_name}</div></td>
                      <td>{methodLabel(t.method)}{t.provider ? <div className="t2">{t.provider}</div> : null}</td>
                      <td className="num tab"><b>{t.kind === "refund" ? "−" : ""}{pkr(t.amount)}</b></td>
                      <td><Pill tone={tone}>{label}</Pill></td>
                      <td style={{ whiteSpace: "nowrap" }}>{dateTime(t.received_at)}{t.verified_by_name && t.status === "verified" ? <div className="t2">by {t.verified_by_name}</div> : null}</td>
                      <td className="num" style={{ whiteSpace: "nowrap" }}>
                        {t.kind === "payment" && t.status === "pending" && canVerify && <Btn size="sm" variant="gold" onClick={() => setSlip({ ...t })}>Verify</Btn>}
                        {t.kind === "refund" && t.status === "pending" && (canEdit || canRefunds) && <Btn size="sm" variant="gold" onClick={() => setPaying(t)}>Mark refund paid</Btn>}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>{tab === "verify" ? "No slips waiting. Nice work." : tab === "refunds" ? "No refunds." : "No transactions match."}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SlipModal payment={slip} onClose={() => setSlip(null)} verifyPath={(id) => `/payments/transactions/${id}/verify`} onDone={() => { setSlip(null); reload(); }} />
      <BookingDrawer idOrRef={open} onClose={() => setOpen(null)} onChanged={reload} />
      {refundFor && <RefundSetupModal b={refundFor} onClose={() => setRefundFor(null)} onDone={() => { setRefundFor(null); reload(); }} />}
      {paying && <RefundPaidModal t={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); reload(); }} />}
    </>
  );
}

function RefundSetupModal({ b, onClose, onDone }: { b: Awaiting; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(b.paid_amount));
  const [method, setMethod] = useState(b.payment_method ?? "bank");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  async function go() {
    setBusy(true); setErr(null);
    try { await api.post(`/payments/refunds/booking/${b.id}`, { amount: Number(amount.replace(/,/g, "")), method }); toast("Refund added"); onDone(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={`Refund for ${b.ref}`} foot={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="gold" busy={busy} onClick={go}>Add refund</Btn></>}>
      <div className="f-grid">
        <Field label="Amount" hint={`Guest paid ${pkr(b.paid_amount)}`}><PreInput pre="PKR" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Refund by"><Select value={method} onChange={(e) => setMethod(e.target.value)} options={METHODS.map(([value, label]) => ({ value, label }))} /></Field>
      </div>
      <ErrorNote error={err} />
    </Modal>
  );
}

function RefundPaidModal({ t, onClose, onDone }: { t: Tx; onClose: () => void; onDone: () => void }) {
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  async function go() {
    setBusy(true); setErr(null);
    try { await api.post(`/payments/refunds/${t.id}/paid`, { reference: ref || undefined }); toast("Refund marked as paid"); onDone(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title="Mark refund paid" foot={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="gold" icon="check" busy={busy} onClick={go}>Refund paid</Btn></>}>
      <p className="muted" style={{ margin: 0 }}>{pkr(t.amount)} back to {t.lead_name} by {methodLabel(t.method).toLowerCase()}{t.provider ? ` (${t.provider})` : ""}. The booking moves to Cancelled once every refund is paid.</p>
      <Field label="Bank or gateway reference"><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" /></Field>
      <ErrorNote error={err} />
    </Modal>
  );
}

/* ---------- checkout rules ---------- */

type Rules = { allow_deposits: boolean; deposit_pct: number; deposit_for: string[]; balance_due_days: number; auto_cancel: boolean; auto_cancel_hours: number; whatsapp_receipt: boolean; email_receipt: boolean; tax_inclusive: boolean };

export function RulesTab() {
  const { data, error, setData } = useData<Rules>("/payments/rules");
  const [r, setR] = useState<Rules | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = useCan("payments.rules", "edit");
  const toast = useToast();
  const confirm = useConfirm();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data) setR(data);
  }, [data]);
  if (error) return <ErrorNote error={error} />;
  if (!r) return <Loading />;
  const dirty = JSON.stringify(r) !== JSON.stringify(data);
  const set = (v: Partial<Rules>) => setR({ ...r, ...v });
  const ro = !canEdit;
  async function save() {
    if (!r) return;
    if (r.auto_cancel && r.auto_cancel_hours < 6 && !(await confirm({ title: "Cancel unpaid bookings this quickly?", body: `Unpaid bookings will be cancelled after ${r.auto_cancel_hours} hour${r.auto_cancel_hours === 1 ? "" : "s"}.`, confirm: "Save anyway" }))) return;
    setBusy(true);
    try { setData(await api.put<Rules>("/payments/rules", r)); toast("Checkout rules saved"); } catch (e) { toast((e as Error).message, "bad"); } finally { setBusy(false); }
  }
  const row = (children: ReactNode) => <div className="f-grid" style={{ margin: "6px 0 10px" }}>{children}</div>;
  return (
    <>
      <PageHead eyebrow="Payments" title="Checkout rules" sub="How deposits, balances and unpaid bookings work for every booking made on the website.">
        {canEdit && <Btn variant="gold" icon="check" busy={busy} disabled={!dirty} onClick={save}>Save changes</Btn>}
      </PageHead>
      <div className="panel" style={{ maxWidth: 760 }}>
        <div className="panel-h"><h2>Checkout rules</h2></div>
        <SwitchRow title="Allow deposits" sub="Guest pays part now and the rest before travel" checked={r.allow_deposits} onChange={(v) => set({ allow_deposits: v })} disabled={ro} />
        {r.allow_deposits && <>
          {row(<>
            <Field label="Deposit"><PreInput pre="%" inputMode="decimal" disabled={ro} value={String(r.deposit_pct)} onChange={(e) => set({ deposit_pct: Number(e.target.value) || 0 })} /></Field>
            <Field label="Balance due"><Select disabled={ro} value={String(r.balance_due_days)} onChange={(e) => set({ balance_due_days: Number(e.target.value) })} options={[3, 7, 14, 21, 30, 45].map((d) => ({ value: String(d), label: `${d} days before travel` }))} /></Field>
          </>)}
          <div className="fld" style={{ marginBottom: 10 }}>
            <span className="lab">Deposits allowed for</span>
            <div className="chips">
              {PRODUCTS.map(([k, l]) => <button key={k} type="button" disabled={ro} className="chip" aria-pressed={r.deposit_for.includes(k)} onClick={() => set({ deposit_for: r.deposit_for.includes(k) ? r.deposit_for.filter((x) => x !== k) : [...r.deposit_for, k] })}>{l}</button>)}
            </div>
          </div>
        </>}
        <SwitchRow title="Auto-cancel unpaid bookings" sub="Releases rooms and seats back to stock" checked={r.auto_cancel} onChange={(v) => set({ auto_cancel: v })} disabled={ro} />
        {r.auto_cancel && row(<Field label="Cancel when unpaid after"><Select disabled={ro} value={String(r.auto_cancel_hours)} onChange={(e) => set({ auto_cancel_hours: Number(e.target.value) })} options={[2, 6, 12, 24, 48, 72].map((h) => ({ value: String(h), label: `${h} hours` }))} /></Field>)}
        <SwitchRow title="Send receipt on WhatsApp" sub="When a payment is verified" checked={r.whatsapp_receipt} onChange={(v) => set({ whatsapp_receipt: v })} disabled={ro} />
        <SwitchRow title="Email receipt to the lead guest" sub="Uses the Payment received email template" checked={r.email_receipt} onChange={(v) => set({ email_receipt: v })} disabled={ro} />
        <SwitchRow title="Show prices including tax" sub="Recommended for Pakistan" checked={r.tax_inclusive} onChange={(v) => set({ tax_inclusive: v })} disabled={ro} />
      </div>
      {canEdit && <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={() => data && setR(data)} />}
    </>
  );
}
