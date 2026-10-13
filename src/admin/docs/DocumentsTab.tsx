"use client";
// Documents → one tab per document. Pick a booking (or ?booking=<id> from Bookings), edit the
// printed texts, print exactly one A4 page or email it to the guest.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, useData } from "@/admin/api";
import { date, money } from "@/admin/format";
import { useCan } from "@/admin/shell";
import { Btn, Empty, ErrorNote, Field, Input, Loading, Modal, PageHead, Panel, Pill, Search, Select, SwitchRow, Textarea, useToast, type Tone } from "@/admin/ui";
import type { DocTexts } from "./defaults";
import {
  HotelVoucher, InvoiceDoc, ReceiptDoc, TransferVoucher, VisaLetterDoc, visaDefaults,
  type DocConfig, type DocData, type DocPayment, type VisaExtra,
} from "./render";
import { printDoc, standaloneHtml } from "./tools";

export type DocTab = "hotel-voucher" | "transfer-voucher" | "invoice" | "quotation" | "visa-letter" | "receipt";

const SUB: Record<DocTab, string> = {
  "hotel-voucher": "Built from the booking. The hotel name, logo, photo, address and contact come from the hotel record, so every voucher is filled in automatically.",
  "transfer-voucher": "Built from the booking: flight, pickup, drop-off, vehicle and passengers.",
  invoice: "Printed on your letterhead. Change the header and footer images under Logo, header & footer.",
  quotation: "Printed on your letterhead. Make a quote for an enquiry or from scratch, then print or email it.",
  "visa-letter": "Printed on your letterhead with the travellers’ passport numbers from the booking.",
  receipt: "Printed on your letterhead for one payment on the booking.",
};

/** Text fields each tab edits, with labels. */
const TEXT_FIELDS: Record<Exclude<DocTab, "quotation">, { key: keyof DocTexts; label: string; hint?: string; rows?: number }[]> = {
  "hotel-voucher": [{ key: "hotelInfo", label: "Important information", hint: "One point per line. Changes show on the page as you type.", rows: 9 }],
  "transfer-voucher": [{ key: "transferInfo", label: "Important information", hint: "One point per line. Changes show on the page as you type.", rows: 8 }],
  invoice: [{ key: "invoiceTerms", label: "Terms", hint: "Changes show on the page as you type.", rows: 6 }],
  "visa-letter": [
    { key: "visaBody", label: "Letter text", hint: "One paragraph per line. {{destination}}, {{start_date}}, {{end_date}} and {{hotel}} are filled in from the booking.", rows: 10 },
    { key: "signatory", label: "Signed by" },
  ],
  receipt: [{ key: "receiptNote", label: "Note under the amounts", rows: 3 }, { key: "signatory", label: "Signed by" }],
};

type Pick = { id: string; ref: string; lead_name: string; product_type: string; product_name: string; start_date: string; status: string; payment_status: string; total_amount: number; currency_code: string };

const STATUS_TONE: Record<string, Tone> = { pending: "warn", supplier: "info", confirmed: "good", travelling: "sig", completed: "plain", refund: "bad", cancelled: "bad" };

export function BookingPicker({ tab, value, onChange }: { tab: string; value: string | null; onChange: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const list = useData<Pick[]>(`/documents/bookings?tab=${tab}${term ? `&q=${encodeURIComponent(term)}` : ""}`);
  const first = list.data?.[0]?.id;
  useEffect(() => {
    if (!value && first && !term) onChange(first);
  }, [value, first, term, onChange]);
  return (
    <Panel>
      <Field label="Booking" hint={tab === "hotel-voucher" ? "Pick another booking to see the voucher change with its hotel" : "Search by booking ref, guest or phone"}>
        <Search value={q} onChange={setQ} placeholder="SKY-26-… or guest name" />
      </Field>
      <div className="doc-pick" role="listbox" aria-label="Bookings">
        {list.loading && !list.data && <Loading />}
        <ErrorNote error={list.error} />
        {list.data?.length === 0 && <div className="muted" style={{ padding: 10, fontSize: 12.5 }}>{term ? "No bookings match." : tab === "hotel-voucher" ? "No hotel bookings yet." : tab === "transfer-voucher" ? "No transfer bookings yet." : "No bookings yet."}</div>}
        {list.data?.map((b) => (
          <button key={b.id} type="button" aria-pressed={b.id === value} onClick={() => onChange(b.id)}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ color: "var(--text)", display: "block" }} className="trunc">{b.lead_name}</b>
              <span className="trunc" style={{ display: "block" }}><span className="mono">{b.ref}</span> · {b.product_name}</span>
            </span>
            <Pill tone={STATUS_TONE[b.status] ?? "plain"}>{b.status}</Pill>
          </button>
        ))}
      </div>
    </Panel>
  );
}

export function EmailDocModal({ open, onClose, defaultTo, title, send }: { open: boolean; onClose: () => void; defaultTo: string; title: string; send: (to: string) => Promise<{ to: string }> }) {
  const [to, setTo] = useState(defaultTo);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => {
    // Reset the address each time the dialog opens for a new document.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setTo(defaultTo); setErr(null); }
  }, [open, defaultTo]);
  async function go() {
    setBusy(true); setErr(null);
    try {
      const r = await send(to.trim());
      toast(`Sent to ${r.to}`);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Email to guest" foot={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="gold" icon="send" busy={busy} onClick={go}>Send</Btn></>}>
      <p className="muted" style={{ margin: 0 }}>{title} goes as an attachment, with a link to open it online. The wording comes from the email template under Settings → Email.</p>
      <Field label="Send to"><Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="guest@example.com" /></Field>
      <ErrorNote error={err} />
    </Modal>
  );
}

export function useDocTexts(cfg: DocConfig | null) {
  const [texts, setTexts] = useState<DocTexts | null>(null);
  const [saved, setSaved] = useState<DocTexts | null>(null);
  useEffect(() => {
    // Copy the loaded texts into editable state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cfg && !saved) { setTexts(cfg.texts); setSaved(cfg.texts); }
  }, [cfg, saved]);
  return { texts, setTexts, saved, setSaved };
}

export function TextsPanel({ tab, fields, texts, saved, onChange, onSaved, extra }: {
  tab: string; fields: { key: keyof DocTexts; label: string; hint?: string; rows?: number }[]; texts: DocTexts; saved: DocTexts;
  onChange: (t: DocTexts) => void; onSaved: (t: DocTexts) => void; extra?: React.ReactNode;
}) {
  const canEdit = useCan(`documents.${tab}`, "edit");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const dirty = fields.some((f) => texts[f.key] !== saved[f.key]) || (tab === "hotel-voucher" && (texts.showHotelContact !== saved.showHotelContact || texts.attachVoucher !== saved.attachVoucher));
  async function save() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {};
      for (const f of fields) body[f.key] = texts[f.key];
      if (tab === "hotel-voucher") { body.showHotelContact = texts.showHotelContact; body.attachVoucher = texts.attachVoucher; }
      const next = await api.put<DocTexts>(`/documents/texts/${tab}`, body);
      onSaved(next);
      toast("Saved. New documents use this text.");
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel>
      <div className="grid" style={{ gap: 14 }}>
        {fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            {f.rows ? (
              <Textarea value={String(texts[f.key])} rows={f.rows} style={{ minHeight: f.rows * 20 }} onChange={(e) => onChange({ ...texts, [f.key]: e.target.value })} readOnly={!canEdit} />
            ) : (
              <Input value={String(texts[f.key])} onChange={(e) => onChange({ ...texts, [f.key]: e.target.value })} readOnly={!canEdit} />
            )}
          </Field>
        ))}
        {extra}
        {canEdit && (
          <div className="row">
            <Btn variant={dirty ? "gold" : "plain"} size="sm" icon="check" busy={busy} disabled={!dirty} onClick={save}>Save text</Btn>
            {dirty && <Btn variant="ghost" size="sm" onClick={() => onChange(saved)}>Undo</Btn>}
          </div>
        )}
      </div>
    </Panel>
  );
}

export function BookingDocTab({ tab, label, initialBooking }: { tab: Exclude<DocTab, "quotation">; label: string; initialBooking: string | null }) {
  const router = useRouter();
  const cfg = useData<DocConfig>("/documents/config");
  const [bookingId, setBookingId] = useState<string | null>(initialBooking);
  const data = useData<DocData>(bookingId ? `/documents/booking/${bookingId}?tab=${tab}` : null);
  const { texts, setTexts, saved, setSaved } = useDocTexts(cfg.data);
  const canSend = useCan(`documents.${tab}`, "create");
  const pageRef = useRef<HTMLDivElement>(null);
  const [mail, setMail] = useState(false);
  const [paymentId, setPaymentId] = useState<string>("");
  const [visa, setVisa] = useState<VisaExtra | null>(null);
  const [letterhead, setLetterhead] = useState<boolean | null>(null);

  const pick = (id: string) => {
    setBookingId(id);
    setPaymentId("");
    setVisa(null);
    router.replace(`/admin/documents/${tab}?booking=${id}`, { scroll: false });
  };
  const d = data.data && data.data.booking.id === bookingId ? data.data : null;
  const payments = useMemo(() => (d?.payments ?? []).filter((p) => p.kind === "payment" && p.status !== "rejected" && p.status !== "failed"), [d]);
  const payment: DocPayment | null = payments.find((p) => p.id === paymentId) ?? payments.filter((p) => p.status === "verified").at(-1) ?? payments.at(-1) ?? null;
  const visaExtra = visa ?? (d ? visaDefaults(d) : null);

  const lhKey = tab === "invoice" || tab === "visa-letter" || tab === "receipt" ? tab : null;
  const docCfg: DocConfig | null = cfg.data && texts ? {
    ...cfg.data, texts,
    branding: lhKey && letterhead !== null ? { ...cfg.data.branding, letterhead_on: { ...cfg.data.branding.letterhead_on, [lhKey]: letterhead } } : cfg.data.branding,
  } : null;

  const title = d ? `${label} ${d.booking.ref}` : label;
  async function send(to: string) {
    const el = pageRef.current?.querySelector<HTMLElement>(".a4wrap");
    if (!el || !d) throw new Error("Pick a booking first");
    return api.post<{ to: string }>("/documents/email", {
      tab, booking_id: d.booking.id, to: to || undefined, title, html: standaloneHtml(el, title),
      amount: tab === "receipt" && payment ? money(payment.amount, payment.currency_code) : undefined,
    });
  }

  let doc: React.ReactNode = null;
  if (d && docCfg) {
    if (tab === "hotel-voucher") doc = <HotelVoucher d={d} cfg={docCfg} />;
    else if (tab === "transfer-voucher") doc = <TransferVoucher d={d} cfg={docCfg} />;
    else if (tab === "invoice") doc = <InvoiceDoc d={d} cfg={docCfg} />;
    else if (tab === "visa-letter" && visaExtra) doc = <VisaLetterDoc d={d} cfg={docCfg} extra={visaExtra} />;
    else if (tab === "receipt") doc = <ReceiptDoc d={d} cfg={docCfg} payment={payment} />;
  }

  return (
    <>
      <PageHead eyebrow="Documents" title={label} sub={SUB[tab]}>
        {canSend && <Btn icon="send" disabled={!d} onClick={() => setMail(true)}>Email to guest</Btn>}
        <Btn variant="gold" icon="dl" disabled={!d} onClick={() => printDoc(pageRef.current?.querySelector(".a4wrap") ?? null)}>Print / Save PDF</Btn>
      </PageHead>
      <ErrorNote error={cfg.error} />
      <div className="doc-layout">
        <div style={{ minWidth: 0 }} ref={pageRef}>
          {!bookingId ? <Panel><Empty icon="file" title="Pick a booking">Choose a booking on the right to fill in this document.</Empty></Panel>
            : data.error ? <ErrorNote error={data.error} />
            : !doc ? <Loading label="Building the document…" />
            : doc}
          {tab === "receipt" && d && !payments.length && <div className="err" style={{ marginTop: 12 }}>This booking has no payments yet, so the receipt shows zero.</div>}
        </div>
        <aside className="grid doc-side" style={{ position: "sticky", top: 96, alignContent: "start" }}>
          <BookingPicker tab={tab} value={bookingId} onChange={pick} />
          {tab === "receipt" && payments.length > 0 && (
            <Panel>
              <Field label="Payment">
                <Select value={payment?.id ?? ""} onChange={(e) => setPaymentId(e.target.value)}
                  options={payments.map((p) => ({ value: p.id, label: `${date(p.received_at)} · ${money(p.amount, p.currency_code)} · ${p.status === "verified" ? "verified" : "not verified yet"}` }))} />
              </Field>
            </Panel>
          )}
          {tab === "visa-letter" && visaExtra && (
            <Panel>
              <div className="grid" style={{ gap: 14 }}>
                <Field label="Addressed to" hint="For this letter only"><Textarea rows={3} value={visaExtra.to} onChange={(e) => setVisa({ ...visaExtra, to: e.target.value })} /></Field>
                <Field label="Subject"><Input value={visaExtra.subject} onChange={(e) => setVisa({ ...visaExtra, subject: e.target.value })} /></Field>
              </div>
            </Panel>
          )}
          {texts && saved && (
            <TextsPanel tab={tab} fields={TEXT_FIELDS[tab]} texts={texts} saved={saved} onChange={setTexts} onSaved={(t) => { setTexts(t); setSaved(t); }}
              extra={tab === "hotel-voucher" ? (
                <div>
                  <SwitchRow title="Show hotel contact" checked={texts.showHotelContact} onChange={(v) => setTexts({ ...texts, showHotelContact: v })} />
                  <SwitchRow title="Attach to confirmation email" checked={texts.attachVoucher} onChange={(v) => setTexts({ ...texts, attachVoucher: v })} />
                </div>
              ) : null}
            />
          )}
          <Panel>
            {lhKey && cfg.data && (
              <SwitchRow title="Print on letterhead" sub="Header and footer images, for this print" checked={letterhead ?? cfg.data.branding.letterhead_on[lhKey]} onChange={setLetterhead} />
            )}
            <Link className="btn btn-sm" href="/admin/documents/branding" style={{ marginTop: lhKey ? 8 : 0 }}>
              {tab.endsWith("voucher") ? "Edit logo, name and footer" : "Change header and footer"}
            </Link>
          </Panel>
        </aside>
      </div>
      {d && <EmailDocModal open={mail} onClose={() => setMail(false)} defaultTo={d.booking.lead_email ?? ""} title={title} send={send} />}
    </>
  );
}
