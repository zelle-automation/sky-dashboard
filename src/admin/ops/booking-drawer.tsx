"use client";
// The booking drawer: pass-style dates, product, lead guest, price, travellers,
// payments ledger, cancellation, notes and history, with every booking action.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, useData } from "../api";
import { ago, date, dateTime, nights, pkr } from "../format";
import { Btn, Drawer, ErrorNote, Icon, IconBtn, KV, Loading, Pill, Textarea, cx, useConfirm, useToast } from "../ui";
import { BookingFormModal, CancelModal, RecordPaymentModal, SlipModal, TravellerModal, type SlipPayment } from "./booking-forms";
import { channelLabel, humanKey, METHOD_ICON, methodLabel, PAY, paxText, productHref, STATUS, TYPE_ICON, waLink, type BookingStatus, type ProductType } from "./status";
import type { Booking, Payment, Traveller } from "./types";

const NEXT: Partial<Record<BookingStatus, [BookingStatus, string][]>> = {
  pending: [["confirmed", "Confirm booking"], ["supplier", "Send to supplier"]],
  supplier: [["confirmed", "Supplier confirmed"]],
  confirmed: [["travelling", "Mark travelling"]],
  travelling: [["completed", "Mark completed"]],
};

export function StatusPill({ s }: { s: BookingStatus }) {
  const [l, t, dot] = STATUS[s] ?? [s, "plain"];
  return <Pill tone={t} dot={dot !== false}>{l}</Pill>;
}
export function PayPill({ s }: { s: keyof typeof PAY }) {
  const [l, t, dot] = PAY[s] ?? [s, "plain"];
  return <Pill tone={t} dot={dot !== false}>{l}</Pill>;
}

export function Thumb({ image, type, lg }: { image: string | null; type: string; lg?: boolean }) {
  return image
    ? <div className={cx("thumb", lg && "lg")} style={{ backgroundImage: `url("${image}")` }} />
    : <div className={cx("thumb", "ops-thumb", lg && "lg")}><Icon name={TYPE_ICON[type as ProductType] ?? "ticket"} /></div>;
}

const PASSPORT: Record<string, [string, "good" | "warn" | "bad"]> = { missing: ["Passport missing", "bad"], received: ["Received", "warn"], verified: ["Complete", "good"] };

export function BookingDrawer({ idOrRef, onClose, onChanged }: { idOrRef: string | null; onClose: () => void; onChanged?: () => void }) {
  const { data: b, error, setData, reload } = useData<Booking>(idOrRef ? `/bookings/${encodeURIComponent(idOrRef)}` : null);
  const [modal, setModal] = useState<null | "modify" | "pay" | "cancel" | "traveller">(null);
  const [trav, setTrav] = useState<Traveller | null>(null);
  const [slip, setSlip] = useState<SlipPayment | null>(null);
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState("");
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    // Keep the notes box in step with the loaded booking.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(b?.internal_notes ?? "");
  }, [b?.id, b?.internal_notes]);

  const show = !!idOrRef;
  const changed = (nb?: Booking) => { if (nb) setData(nb); else reload(); onChanged?.(); };

  async function run(label: string, fn: () => Promise<Booking>, ok: string) {
    setBusy(label);
    try { changed(await fn()); toast(ok); } catch (e) { toast((e as Error).message, "bad"); } finally { setBusy(""); }
  }

  if (!show) return <Drawer open={false} onClose={onClose} head={null}>{null}</Drawer>;
  if (!b) {
    return <Drawer open onClose={onClose} head={<b>Booking</b>}>{error ? <ErrorNote error={error} /> : <Loading />}</Drawer>;
  }

  const type = b.product_type as ProductType;
  const snap = b.product_snapshot ?? {};
  const isHotel = type === "hotel";
  const balance = b.total_amount - b.paid_amount;
  const pax = paxText(b.adults, b.children, b.infants);
  const n = nights(b.start_date, b.end_date);
  const voucherDoc = type === "transfer" ? "transfer-voucher" : "hotel-voucher";
  const open = b.status !== "cancelled" && b.status !== "refund";
  const where = b.product ? [b.product.destination, b.product.country].filter(Boolean).join(", ") : null;
  const href = productHref(type, b.product_id);
  const waText = `Assalam o Alaikum ${b.lead_name.split(" ")[0]}, this is Sky Holidays about your booking ${b.ref} (${b.product_name}, ${date(b.start_date)}). `
    + (balance > 0 && open ? `The balance due is ${pkr(balance)}. ` : "") + "Please let us know if you need anything.";

  const details: [string, React.ReactNode][] = [
    ...Object.entries(snap).filter(([, v]) => v !== "" && v != null && typeof v !== "object").map(([k, v]) => [humanKey(k), String(v)] as [string, React.ReactNode]),
    ...(isHotel && n ? [["Nights", String(n)] as [string, React.ReactNode]] : []),
    ["Supplier conf.", <b key="s" className="mono">{b.supplier_ref || (b.status === "supplier" ? "Pending" : "–")}</b>],
    ["Guests", pax],
    ...(b.special_requests ? [["Special requests", b.special_requests] as [string, React.ReactNode]] : []),
  ];

  return (
    <>
      <Drawer open onClose={onClose} label={`Booking ${b.ref}`}
        head={<>
          <div className="row"><span className="mono" style={{ color: "var(--gold)", fontSize: 14 }}>{b.ref}</span><StatusPill s={b.status} /><PayPill s={b.payment_status} /></div>
          <h2 style={{ fontSize: 26, marginTop: 6 }}>{b.lead_name}</h2>
          <div className="t2" style={{ color: "var(--muted)" }}>
            Booked {ago(b.created_at)} via {channelLabel(b.channel)}{b.created_by_name ? ` by ${b.created_by_name}` : ""}{b.assigned_name ? ` · Assigned to ${b.assigned_name}` : ""}
          </div>
        </>}
        foot={<>
          {b.can.edit && NEXT[b.status]?.map(([s, label], i) => (
            <Btn key={s} variant={i === 0 ? "gold" : "plain"} icon="check" busy={busy === s}
              onClick={() => run(s, () => api.post<Booking>(`/bookings/${b.id}/status`, { status: s }), `Status changed to ${STATUS[s][0]}`)}>{label}</Btn>
          ))}
          {b.can.voucher && <Link className="btn" href={`/admin/documents/${voucherDoc}?booking=${b.id}`}><Icon name="file" />Voucher</Link>}
          {b.can.invoice && <Link className="btn" href={`/admin/documents/invoice?booking=${b.id}`}><Icon name="file" />Invoice</Link>}
          <Btn icon="send" busy={busy === "email"} onClick={() => run("email", () => api.post<Booking>(`/bookings/${b.id}/email`), `Documents emailed to ${b.lead_email}`)}>Email documents</Btn>
          <a className="btn" href={waLink(b.lead_phone, waText)} target="_blank" rel="noreferrer"><Icon name="whats" />WhatsApp guest</a>
          <span className="spacer" />
          {b.can.edit && <Btn icon="edit" onClick={() => setModal("modify")}>Modify</Btn>}
          {b.can.edit && open && <Btn variant="danger" onClick={() => setModal("cancel")}>Cancel &amp; refund</Btn>}
        </>}
      >
        <div className="pass">
          <div>
            <div className="k">{isHotel ? "Check-in" : "Starts"}</div>
            <div className="bigv">{date(b.start_date, false)}</div>
            <div className="t2" style={{ color: "var(--muted)" }}>{isHotel ? `From ${b.product?.check_in ?? "14:00"}` : snap.time_slot ? `At ${String(snap.time_slot)}` : snap.pickup_time ? `Pickup ${String(snap.pickup_time)}` : date(b.start_date).slice(-4)}</div>
          </div>
          <svg className="arc" viewBox="0 0 120 44" aria-hidden="true"><path d="M6 38 Q60 -10 114 38" fill="none" stroke="currentColor" strokeDasharray="3 4" /><circle cx="6" cy="38" r="3.5" fill="currentColor" /><circle cx="114" cy="38" r="3.5" fill="currentColor" /><g transform="translate(52 8) rotate(15)"><path d="M0 6 L14 6 L18 2 L20 3 L17 6 L22 6 L22 8 L17 8 L20 11 L18 12 L14 8 L0 8 Z" fill="currentColor" /></g></svg>
          <div style={{ textAlign: "right" }}>
            <div className="k">{isHotel ? "Check-out" : "Ends"}</div>
            <div className="bigv">{date(b.end_date ?? b.start_date, false)}</div>
            <div className="t2" style={{ color: "var(--muted)" }}>{isHotel ? `Until ${b.product?.check_out ?? "12:00"}${n ? ` · ${n} night${n > 1 ? "s" : ""}` : ""}` : pax}</div>
          </div>
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <Thumb image={b.image} type={type} lg />
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 15 }}>{b.product_name}</b>
              <div className="t2" style={{ color: "var(--muted)" }}>{where || TYPE_LABEL_OR(type)}{b.product?.address && isHotel ? ` · ${b.product.address}` : ""}</div>
            </div>
            <span className="spacer" />
            {href && <Link className="btn btn-sm" href={href}>Open</Link>}
          </div>
          <div style={{ marginTop: 14 }}><KV items={details} /></div>
        </div>

        <div className="grid g-2">
          <div className="panel" style={{ padding: 16 }}>
            <div className="panel-h"><h3>Lead guest</h3><span className="spacer" />{b.can.edit && <IconBtn icon="edit" label="Edit guest" onClick={() => setModal("modify")} />}</div>
            <KV items={[
              ["Phone / WhatsApp", b.lead_phone],
              ["Email", b.lead_email ?? "–"],
              ["CNIC", b.lead_cnic ?? "–"],
              ["Nationality", b.nationality_name ?? b.lead_nationality ?? "–"],
            ]} />
          </div>
          <div className="panel" style={{ padding: 16 }}>
            <div className="panel-h"><h3>Price breakdown</h3></div>
            <div className="ledger">
              <div className="ln"><span>Base price</span><b className="tab">{pkr(b.base_amount)}</b></div>
              <div className="ln"><span>Taxes</span><span className="tab">{pkr(b.tax_amount)}</span></div>
              <div className="ln"><span>Service fee</span><span className="tab">{pkr(b.fee_amount)}</span></div>
              {b.discount_amount > 0 && <div className="ln"><span>Discount</span><span className="tab">− {pkr(b.discount_amount)}</span></div>}
              <div className="ln tot"><span>Total</span><span className="tab">{pkr(b.total_amount)}</span></div>
              <div className="ln"><span style={{ color: "var(--good)" }}>Paid</span><span className="tab" style={{ color: "var(--good)" }}>{pkr(b.paid_amount)}</span></div>
              <div className="ln"><span style={{ color: "var(--warn)" }}>Balance</span><b className="tab" style={{ color: "var(--warn)" }}>{pkr(Math.max(balance, 0))}</b></div>
              {b.can.seeCosts && b.supplier_cost != null && <>
                <div className="ln" style={{ borderTop: "1px dashed var(--line)", marginTop: 6, paddingTop: 10 }}><span className="muted">Supplier cost{b.supplier_name ? ` · ${b.supplier_name}` : ""}</span><span className="tab muted">{pkr(b.supplier_cost)}</span></div>
                <div className="ln"><span className="muted">Margin</span><span className="tab">{pkr(b.margin)}{b.total_amount ? ` · ${((Number(b.margin) / b.total_amount) * 100).toFixed(1)}%` : ""}</span></div>
              </>}
            </div>
          </div>
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <div className="panel-h"><h3>Travellers</h3><span className="spacer" />{b.can.edit && <Btn size="sm" icon="plus" onClick={() => { setTrav(null); setModal("traveller"); }}>Add traveller</Btn>}</div>
          {b.travellers.length ? (
            <div className="tbl-wrap" style={{ margin: "0 -16px", padding: "0 16px" }}>
              <table>
                <thead><tr><th>Name</th><th>Type</th><th>Passport</th><th>Documents</th>{b.can.edit && <th />}</tr></thead>
                <tbody>
                  {b.travellers.map((t, i) => (
                    <tr key={t.id}>
                      <td><b>{[t.title, t.full_name].filter(Boolean).join(" ")}</b></td>
                      <td>{t.kind[0].toUpperCase() + t.kind.slice(1)}{i === 0 ? " · lead" : ""}</td>
                      <td className="mono">{t.passport_no ?? "–"}{t.passport_expiry && <div className="t2">Exp. {date(t.passport_expiry)}</div>}</td>
                      <td><Pill tone={PASSPORT[t.passport_status][1]}>{PASSPORT[t.passport_status][0]}</Pill></td>
                      {b.can.edit && <td className="num" style={{ whiteSpace: "nowrap" }}>
                        <IconBtn icon="edit" label={`Edit ${t.full_name}`} onClick={() => { setTrav(t); setModal("traveller"); }} />
                        <IconBtn icon="trash" label={`Remove ${t.full_name}`} onClick={async () => {
                          if (await confirm({ title: `Remove ${t.full_name}?`, body: "Their passport details on this booking will be deleted.", confirm: "Remove", danger: true })) {
                            run("t", () => api.del<Booking>(`/bookings/${b.id}/travellers/${t.id}`), "Traveller removed");
                          }
                        }} />
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="t2 muted">No travellers added yet.</div>}
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <div className="panel-h"><h3>Payments</h3><span className="spacer" />{b.can.record && open && <Btn size="sm" variant="gold" icon="plus" onClick={() => setModal("pay")}>Record payment</Btn>}</div>
          <div className="list">
            {b.payments.map((p) => <PaymentLine key={p.id} p={p} b={b} busy={busy} onSlip={() => setSlip({ ...p, ref: b.ref, lead_name: b.lead_name })}
              onRefundPaid={() => run(p.id, () => api.post<Booking>(`/bookings/${b.id}/payments/${p.id}/refund-paid`), "Refund marked as paid")} />)}
            {!b.payments.length && <div className="li"><div className="grow t2">No payment yet{b.payment_due_at ? `. Due ${dateTime(b.payment_due_at)}` : ""}.</div>
              <a className="btn btn-sm" href={waLink(b.lead_phone, `${waText}`)} target="_blank" rel="noreferrer"><Icon name="send" />Send reminder</a></div>}
          </div>
        </div>

        <div className="grid g-2">
          <div className="panel" style={{ padding: 16 }}>
            <div className="panel-h"><h3>Cancellation</h3></div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{b.cancellation_policy || "No cancellation policy recorded. Add one under Modify."}</p>
            {b.cancel_reason && <div className="row" style={{ marginTop: 12 }}><Pill tone="bad">Cancelled {b.cancelled_at ? date(b.cancelled_at) : ""}</Pill><span className="t2 muted" style={{ fontSize: 12.5 }}>{b.cancel_reason}</span></div>}
          </div>
          <div className="panel" style={{ padding: 16 }}>
            <div className="panel-h"><h3>Internal notes</h3>{notes !== (b.internal_notes ?? "") && <><span className="spacer" /><Btn size="sm" variant="gold" busy={busy === "notes"} onClick={() => run("notes", () => api.patch<Booking>(`/bookings/${b.id}`, { internal_notes: notes }), "Notes saved")}>Save</Btn></>}</div>
            <Textarea style={{ minHeight: 70 }} placeholder="Visible to staff only" value={notes} disabled={!b.can.edit} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <div className="panel-h"><h3>History</h3></div>
          <ul className="timeline">
            {b.events.map((e) => (
              <li key={e.id}>
                <span className={cx("dt", e.kind === "payment" ? "s" : e.kind === "status" && /Confirmed|Completed/.test(e.message) ? "g" : "")} />
                <div><b style={{ fontSize: 13 }}>{e.message}</b>{e.user_name && <><br /><small>{e.user_name}</small></>}</div>
                <small>{ago(e.created_at)}</small>
              </li>
            ))}
          </ul>
        </div>
      </Drawer>

      {modal === "modify" && <BookingFormModal open booking={b} onClose={() => setModal(null)} onSaved={() => { setModal(null); changed(); }} />}
      {modal === "pay" && <RecordPaymentModal open booking={b} onClose={() => setModal(null)} onSaved={(nb) => { setModal(null); changed(nb); }} />}
      {modal === "cancel" && <CancelModal open booking={b} onClose={() => setModal(null)} onSaved={(nb) => { setModal(null); changed(nb); }} />}
      {modal === "traveller" && <TravellerModal open booking={b} traveller={trav} onClose={() => setModal(null)} onSaved={(nb) => { setModal(null); changed(nb); }} />}
      <SlipModal payment={slip} onClose={() => setSlip(null)} verifyPath={(pid) => `/bookings/${b.id}/payments/${pid}/verify`} onDone={(d) => { setSlip(null); changed(d as Booking); }} />
    </>
  );
}

const TYPE_LABEL_OR = (t: string) => t[0].toUpperCase() + t.slice(1);

function PaymentLine({ p, b, busy, onSlip, onRefundPaid }: { p: Payment; b: Booking; busy: string; onSlip: () => void; onRefundPaid: () => void }) {
  const refund = p.kind === "refund";
  const tone = p.status === "verified" ? "good" : p.status === "pending" ? (refund ? "bad" : "sig") : "bad";
  const label = refund ? (p.status === "verified" ? "Refunded" : "Refund due") : p.status === "verified" ? "Received" : p.status === "pending" ? "Slip to verify" : p.status === "rejected" ? "Rejected" : "Failed";
  return (
    <div className="li">
      <span className={cx("pill", "nodot", refund ? "p-bad" : p.status === "pending" ? "p-sig" : "p-gold")} style={{ padding: 8 }}><Icon name={p.slip_url && p.status === "pending" ? "file" : refund ? "refresh" : METHOD_ICON[p.method] ?? "card"} /></span>
      <div className="grow">
        <b style={{ fontSize: 13 }}>{refund ? "Refund · " : ""}{methodLabel(p.method)}{p.provider ? ` · ${p.provider}` : ""}</b>
        <div className="t2"><span className="mono">{p.reference ?? "No reference"}</span> · {dateTime(p.received_at)}{p.verified_by_name && p.status === "verified" ? ` · checked by ${p.verified_by_name}` : ""}</div>
      </div>
      <b className="tab" style={{ whiteSpace: "nowrap" }}>{refund ? "− " : ""}{pkr(p.amount)}</b>
      <Pill tone={tone}>{label}</Pill>
      {!refund && p.status === "pending" && b.can.verify && <Btn size="sm" variant="gold" onClick={onSlip}>{p.slip_url ? "Verify slip" : "Verify"}</Btn>}
      {refund && p.status === "pending" && b.can.refund && <Btn size="sm" variant="gold" busy={busy === p.id} onClick={onRefundPaid}>Mark refund paid</Btn>}
    </div>
  );
}
