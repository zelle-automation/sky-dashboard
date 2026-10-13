"use client";
// Modals used by the booking drawer and the bookings page: new booking / modify,
// record payment, verify slip, cancel & refund, traveller editor.
import { useEffect, useMemo, useState } from "react";
import { api, useData } from "../api";
import { pkr } from "../format";
import { useMe } from "../shell";
import { Btn, Check, ErrorNote, Field, ImageUpload, Input, Modal, PreInput, Select, Textarea, useToast } from "../ui";
import { CHANNELS, METHODS, SNAPSHOT_FIELDS, TYPE_LABEL, type ProductType } from "./status";
import type { Booking, Traveller } from "./types";

type Staff = { id: string; name: string; role: string };
type Product = { id: string; name: string; sub: string | null; price: number | null };

const num = (v: string) => (v === "" ? 0 : Number(v.replace(/,/g, "")) || 0);
const str = (v: unknown) => (v == null ? "" : String(v));

/* ---------- new booking / modify ---------- */

type Form = {
  product_type: ProductType; product_id: string | null; product_name: string; snapshot: Record<string, string>;
  start_date: string; end_date: string; adults: string; children: string; infants: string;
  lead_name: string; lead_phone: string; lead_email: string; lead_cnic: string; lead_nationality: string;
  base_amount: string; tax_amount: string; fee_amount: string; discount_amount: string;
  supplier_name: string; supplier_cost: string; supplier_ref: string; payment_method: string; channel: string; assigned_to: string;
  special_requests: string; cancellation_policy: string;
};

const fromBooking = (b: Booking | null): Form => ({
  product_type: (b?.product_type ?? "hotel") as ProductType, product_id: b?.product_id ?? null, product_name: b?.product_name ?? "",
  snapshot: Object.fromEntries(Object.entries(b?.product_snapshot ?? {}).map(([k, v]) => [k, str(v)])),
  start_date: b?.start_date ?? "", end_date: b?.end_date ?? "", adults: str(b?.adults ?? 2), children: str(b?.children ?? 0), infants: str(b?.infants ?? 0),
  lead_name: b?.lead_name ?? "", lead_phone: b?.lead_phone ?? "", lead_email: b?.lead_email ?? "", lead_cnic: b?.lead_cnic ?? "", lead_nationality: b?.lead_nationality ?? "PK",
  base_amount: str(b?.base_amount ?? ""), tax_amount: str(b?.tax_amount ?? ""), fee_amount: str(b?.fee_amount ?? ""), discount_amount: str(b?.discount_amount ?? ""),
  supplier_name: b?.supplier_name ?? "", supplier_cost: str(b?.supplier_cost ?? ""), supplier_ref: b?.supplier_ref ?? "", payment_method: b?.payment_method ?? "bank",
  channel: b?.channel ?? "phone", assigned_to: b?.assigned_to ?? "", special_requests: b?.special_requests ?? "", cancellation_policy: b?.cancellation_policy ?? "",
});

export function BookingFormModal({ open, booking, prefill, onClose, onSaved }: {
  open: boolean; booking?: Booking | null; prefill?: Partial<Form>; onClose: () => void; onSaved: (b: { id: string; ref: string }) => void;
}) {
  const me = useMe();
  const editing = !!booking;
  const [f, setF] = useState<Form>(() => ({ ...fromBooking(booking ?? null), ...prefill }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const staff = useData<Staff[]>(open ? "/bookings/staff" : null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    // Reset the form each time the modal opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setF({ ...fromBooking(booking ?? null), ...prefill });
    setErr(null);
    setTerm("");
  }, [open, booking, prefill]);

  useEffect(() => {
    if (!open || f.product_type === "flight" || f.product_type === "other") return;
    let live = true;
    const t = setTimeout(() => {
      api.get<Product[]>(`/bookings/products?type=${f.product_type}&q=${encodeURIComponent(term)}`).then((p) => live && setProducts(p)).catch(() => live && setProducts([]));
    }, 180);
    return () => { live = false; clearTimeout(t); };
  }, [open, f.product_type, term]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const total = num(f.base_amount) + num(f.tax_amount) + num(f.fee_amount) - num(f.discount_amount);
  const fields = SNAPSHOT_FIELDS[f.product_type];

  async function save() {
    setBusy(true); setErr(null);
    const snapshot: Record<string, unknown> = { ...f.snapshot };
    for (const [k, v] of Object.entries(snapshot)) if (v === "") delete snapshot[k];
    if (snapshot.rooms) snapshot.rooms = Number(snapshot.rooms) || snapshot.rooms;
    const body: Record<string, unknown> = {
      product_type: f.product_type, product_id: f.product_id, product_name: f.product_name, product_snapshot: snapshot,
      start_date: f.start_date, end_date: f.end_date || null, adults: num(f.adults), children: num(f.children), infants: num(f.infants),
      lead_name: f.lead_name, lead_phone: f.lead_phone, lead_email: f.lead_email || null, lead_cnic: f.lead_cnic || null, lead_nationality: f.lead_nationality || null,
      base_amount: num(f.base_amount), tax_amount: num(f.tax_amount), fee_amount: num(f.fee_amount), discount_amount: num(f.discount_amount), total_amount: Math.max(total, 0),
      supplier_ref: f.supplier_ref || null, payment_method: f.payment_method || null, channel: f.channel, assigned_to: f.assigned_to || null,
      special_requests: f.special_requests || null, cancellation_policy: f.cancellation_policy || null,
    };
    if (!me.limits.hideCosts) { body.supplier_name = f.supplier_name || null; body.supplier_cost = f.supplier_cost === "" ? null : num(f.supplier_cost); }
    try {
      const out = editing ? await api.patch<Booking>(`/bookings/${booking!.id}`, body) : await api.post<{ id: string; ref: string }>("/bookings", body);
      toast(editing ? "Booking updated" : `Booking ${out.ref} created`);
      onSaved({ id: out.id, ref: out.ref });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} wide title={editing ? `Modify ${booking!.ref}` : "New booking"} foot={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="gold" icon="check" busy={busy} onClick={save}>{editing ? "Save changes" : "Create booking"}</Btn>
    </>}>
      <div className="f-grid">
        <Field label="Product type">
          <Select value={f.product_type} onChange={(e) => { set("product_type", e.target.value as ProductType); set("product_id", null); }}
            options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
        </Field>
        <Field label="Product" hint={f.product_id ? "Linked to the catalogue" : "Pick from the list or type a name"}>
          <Input value={f.product_name} onChange={(e) => { set("product_name", e.target.value); set("product_id", null); setTerm(e.target.value); }} placeholder="Search by name" />
        </Field>
        {products.length > 0 && !f.product_id && f.product_name.length > 0 && (
          <div className="span-all ops-picks">
            {products.slice(0, 8).map((p) => (
              <button key={p.id} type="button" className="chip" onClick={() => {
                set("product_id", p.id); set("product_name", p.name);
                if (!f.base_amount && p.price) set("base_amount", String(p.price));
              }}>{p.name}{p.sub && <span className="n">{p.sub}</span>}</button>
            ))}
          </div>
        )}
        <Field label="Start date"><Input type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
        <Field label="End date"><Input type="date" value={f.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
        <div className="span-all f-grid c3">
          <Field label="Adults"><Input type="number" min={0} value={f.adults} onChange={(e) => set("adults", e.target.value)} /></Field>
          <Field label="Children"><Input type="number" min={0} value={f.children} onChange={(e) => set("children", e.target.value)} /></Field>
          <Field label="Infants"><Input type="number" min={0} value={f.infants} onChange={(e) => set("infants", e.target.value)} /></Field>
        </div>
        {fields.map(([k, label]) => (
          <Field key={k} label={label}><Input value={f.snapshot[k] ?? ""} onChange={(e) => set("snapshot", { ...f.snapshot, [k]: e.target.value })} /></Field>
        ))}
      </div>
      <h3 className="ops-h3">Lead guest</h3>
      <div className="f-grid">
        <Field label="Full name"><Input value={f.lead_name} onChange={(e) => set("lead_name", e.target.value)} /></Field>
        <Field label="Phone / WhatsApp"><Input value={f.lead_phone} onChange={(e) => set("lead_phone", e.target.value)} placeholder="+92 300 0000000" /></Field>
        <Field label="Email"><Input type="email" value={f.lead_email} onChange={(e) => set("lead_email", e.target.value)} /></Field>
        <Field label="CNIC"><Input value={f.lead_cnic} onChange={(e) => set("lead_cnic", e.target.value)} placeholder="42101-1234567-1" /></Field>
        <Field label="Nationality" hint="Two-letter country code, e.g. PK"><Input value={f.lead_nationality} maxLength={2} onChange={(e) => set("lead_nationality", e.target.value.toUpperCase())} /></Field>
        <Field label="Channel"><Select value={f.channel} onChange={(e) => set("channel", e.target.value)} options={CHANNELS.map(([value, label]) => ({ value, label }))} /></Field>
      </div>
      <h3 className="ops-h3">Price</h3>
      <div className="f-grid">
        <Field label="Base price"><PreInput pre="PKR" inputMode="decimal" value={f.base_amount} onChange={(e) => set("base_amount", e.target.value)} /></Field>
        <Field label="Taxes"><PreInput pre="PKR" inputMode="decimal" value={f.tax_amount} onChange={(e) => set("tax_amount", e.target.value)} /></Field>
        <Field label="Service fee"><PreInput pre="PKR" inputMode="decimal" value={f.fee_amount} onChange={(e) => set("fee_amount", e.target.value)} /></Field>
        <Field label="Discount"><PreInput pre="PKR" inputMode="decimal" value={f.discount_amount} onChange={(e) => set("discount_amount", e.target.value)} /></Field>
        <Field label="Total" className="span-all"><div className="ops-total tab">{pkr(Math.max(total, 0))}</div></Field>
        <Field label="Payment method"><Select value={f.payment_method} onChange={(e) => set("payment_method", e.target.value)} options={METHODS.map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="Assigned to"><Select value={f.assigned_to} placeholder="Nobody yet" onChange={(e) => set("assigned_to", e.target.value)} options={(staff.data ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.role})` }))} /></Field>
        {!me.limits.hideCosts && <>
          <Field label="Supplier"><Input value={f.supplier_name} onChange={(e) => set("supplier_name", e.target.value)} /></Field>
          <Field label="Supplier cost"><PreInput pre="PKR" inputMode="decimal" value={f.supplier_cost} onChange={(e) => set("supplier_cost", e.target.value)} /></Field>
        </>}
        <Field label="Supplier / hotel confirmation no."><Input value={f.supplier_ref} onChange={(e) => set("supplier_ref", e.target.value)} /></Field>
        <Field label="Special requests"><Input value={f.special_requests} onChange={(e) => set("special_requests", e.target.value)} /></Field>
        <Field label="Cancellation policy" className="span-all"><Textarea value={f.cancellation_policy} onChange={(e) => set("cancellation_policy", e.target.value)} placeholder="Free cancellation until 3 days before arrival." /></Field>
      </div>
      <ErrorNote error={err} />
    </Modal>
  );
}

/* ---------- record payment ---------- */

export function RecordPaymentModal({ open, booking, onClose, onSaved }: { open: boolean; booking: Booking; onClose: () => void; onSaved: (b: Booking) => void }) {
  const balance = Math.max(booking.total_amount - booking.paid_amount, 0);
  const [f, setF] = useState({ method: booking.payment_method ?? "bank", provider: "", amount: String(balance || ""), reference: "", slip_url: null as string | null, verified: true, note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  async function save() {
    setBusy(true); setErr(null);
    try {
      const b = await api.post<Booking>(`/bookings/${booking.id}/payments`, { ...f, amount: num(f.amount) });
      toast(f.verified ? "Payment recorded" : "Payment added for verification");
      onSaved(b);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Record payment" foot={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="gold" icon="check" busy={busy} onClick={save}>Record payment</Btn>
    </>}>
      <div className="f-grid">
        <Field label="Method"><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} options={METHODS.map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="Bank, wallet or card"><Input value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} placeholder="Meezan Bank, JazzCash, Visa •• 4417" /></Field>
        <Field label="Amount" hint={`Balance ${pkr(balance)}`}><PreInput pre="PKR" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Reference / transaction ID"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
        <Field label="Payment slip" className="span-all"><ImageUpload value={f.slip_url} onChange={(u) => setF({ ...f, slip_url: u })} folder="slips" label="Upload slip or screenshot" aspect="3/1" contain /></Field>
        <Field label="Note" className="span-all"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
      <Check label="Money received and checked (mark as verified)" checked={f.verified} onChange={(v) => setF({ ...f, verified: v })} />
      <ErrorNote error={err} />
    </Modal>
  );
}

/* ---------- slip viewer + verify ---------- */

export type SlipPayment = { id: string; amount: number; method: string; provider: string | null; reference: string | null; slip_url: string | null; ref?: string; lead_name?: string };

export function SlipModal({ payment, onClose, onDone, verifyPath }: { payment: SlipPayment | null; onClose: () => void; onDone: (data: unknown) => void; verifyPath: (id: string) => string }) {
  const [busy, setBusy] = useState<"" | "ok" | "no">("");
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  async function act(approve: boolean) {
    if (!payment) return;
    setBusy(approve ? "ok" : "no"); setErr(null);
    try {
      const d = await api.post(verifyPath(payment.id), { approve });
      toast(approve ? "Payment verified" : "Slip rejected", approve ? "ok" : "bad");
      onDone(d);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }
  return (
    <Modal open={!!payment} onClose={onClose} title="Verify payment slip" foot={<>
      <Btn variant="danger" busy={busy === "no"} onClick={() => act(false)}>Reject</Btn>
      <Btn variant="gold" icon="check" busy={busy === "ok"} onClick={() => act(true)}>Verify payment</Btn>
    </>}>
      {payment && (
        <>
          <div className="kv">
            {payment.ref && <div><span>Booking</span><b className="mono">{payment.ref}</b></div>}
            {payment.lead_name && <div><span>Guest</span><b>{payment.lead_name}</b></div>}
            <div><span>Amount</span><b className="tab">{pkr(payment.amount)}</b></div>
            <div><span>From</span><b>{payment.provider ?? payment.method}</b></div>
            <div><span>Reference</span><b className="mono">{payment.reference ?? "–"}</b></div>
          </div>
          {payment.slip_url ? (
            <a href={payment.slip_url} target="_blank" rel="noreferrer" className="ops-slip">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={payment.slip_url} alt="Payment slip uploaded by the guest" />
            </a>
          ) : <div className="muted">No slip image was uploaded. Check your bank statement for the reference above.</div>}
          <ErrorNote error={err} />
        </>
      )}
    </Modal>
  );
}

/* ---------- cancel & refund ---------- */

export function CancelModal({ open, booking, onClose, onSaved }: { open: boolean; booking: Booking; onClose: () => void; onSaved: (b: Booking) => void }) {
  const [f, setF] = useState({ reason: "", refund_amount: String(booking.paid_amount || 0), refund_method: booking.payment_method ?? "bank" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  async function save() {
    setBusy(true); setErr(null);
    try {
      const b = await api.post<Booking>(`/bookings/${booking.id}/cancel`, { ...f, refund_amount: num(f.refund_amount) });
      toast(num(f.refund_amount) > 0 ? "Cancelled · refund added to Refunds" : "Booking cancelled");
      onSaved(b);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title={`Cancel ${booking.ref}`} foot={<>
      <Btn variant="ghost" onClick={onClose}>Keep booking</Btn>
      <Btn variant="danger" busy={busy} onClick={save}>Cancel booking</Btn>
    </>}>
      {booking.cancellation_policy && <div className="muted" style={{ fontSize: 13 }}>{booking.cancellation_policy}</div>}
      <Field label="Reason"><Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Why is this booking being cancelled?" /></Field>
      <div className="f-grid">
        <Field label="Refund to guest" hint={`Paid so far ${pkr(booking.paid_amount)}. Enter 0 for no refund.`}><PreInput pre="PKR" inputMode="decimal" value={f.refund_amount} onChange={(e) => setF({ ...f, refund_amount: e.target.value })} /></Field>
        <Field label="Refund by"><Select value={f.refund_method} onChange={(e) => setF({ ...f, refund_method: e.target.value })} options={METHODS.map(([value, label]) => ({ value, label }))} /></Field>
      </div>
      <ErrorNote error={err} />
    </Modal>
  );
}

/* ---------- traveller ---------- */

export function TravellerModal({ open, booking, traveller, onClose, onSaved }: { open: boolean; booking: Booking; traveller: Traveller | null; onClose: () => void; onSaved: (b: Booking) => void }) {
  const blank = useMemo(() => ({ title: "", full_name: "", kind: "adult", date_of_birth: "", nationality: "PK", passport_no: "", passport_expiry: "", passport_status: "missing" }), []);
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => {
    if (!open) return;
    // Load the traveller being edited (or a blank form) when the modal opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setF(traveller ? {
      title: traveller.title ?? "", full_name: traveller.full_name, kind: traveller.kind, date_of_birth: traveller.date_of_birth ?? "", nationality: traveller.nationality ?? "",
      passport_no: traveller.passport_no ?? "", passport_expiry: traveller.passport_expiry ?? "", passport_status: traveller.passport_status,
    } : blank);
    setErr(null);
  }, [open, traveller, blank]);
  async function save() {
    setBusy(true); setErr(null);
    const body = { ...f, date_of_birth: f.date_of_birth || null, passport_expiry: f.passport_expiry || null, nationality: f.nationality || null };
    try {
      const b = traveller ? await api.patch<Booking>(`/bookings/${booking.id}/travellers/${traveller.id}`, body) : await api.post<Booking>(`/bookings/${booking.id}/travellers`, body);
      toast(traveller ? "Traveller updated" : "Traveller added");
      onSaved(b);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title={traveller ? "Edit traveller" : "Add traveller"} foot={<>
      <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      <Btn variant="gold" icon="check" busy={busy} onClick={save}>Save traveller</Btn>
    </>}>
      <div className="f-grid">
        <Field label="Title"><Select value={f.title} placeholder="–" onChange={(e) => setF({ ...f, title: e.target.value })} options={["Mr", "Mrs", "Ms", "Miss", "Master", "Dr"]} /></Field>
        <Field label="Full name (as on passport)"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Type"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} options={[{ value: "adult", label: "Adult" }, { value: "child", label: "Child" }, { value: "infant", label: "Infant" }]} /></Field>
        <Field label="Date of birth"><Input type="date" value={f.date_of_birth} onChange={(e) => setF({ ...f, date_of_birth: e.target.value })} /></Field>
        <Field label="Nationality"><Input maxLength={2} value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value.toUpperCase() })} /></Field>
        <Field label="Passport no."><Input value={f.passport_no} onChange={(e) => setF({ ...f, passport_no: e.target.value.toUpperCase() })} /></Field>
        <Field label="Passport expiry"><Input type="date" value={f.passport_expiry} onChange={(e) => setF({ ...f, passport_expiry: e.target.value })} /></Field>
        <Field label="Passport copy"><Select value={f.passport_status} onChange={(e) => setF({ ...f, passport_status: e.target.value })} options={[{ value: "missing", label: "Missing" }, { value: "received", label: "Received" }, { value: "verified", label: "Checked and complete" }]} /></Field>
      </div>
      <ErrorNote error={err} />
    </Modal>
  );
}
