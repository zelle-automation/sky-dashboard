"use client";
// Enquiry drawer (message, contact, stage, assignment, quote, reply by email or WhatsApp,
// notes, conversion to a booking) and the "Log enquiry" form.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, useData } from "../api";
import { ago, date, dateTime, initials, pkr } from "../format";
import { Btn, Drawer, ErrorNote, Field, Input, Loading, Modal, Pill, PreInput, Select, Textarea, cx, useToast } from "../ui";
import { CHANNELS, channelLabel, SERVICES, serviceLabel, STAGES, stageOf, TYPE_LABEL, waLink, type ProductType } from "./status";
import type { EnquiryDetail } from "./types";

type Staff = { id: string; name: string; role: string };
const num = (v: string) => (v === "" ? null : Number(v.replace(/,/g, "")) || 0);
const s = (v: unknown) => (v == null ? "" : String(v));
const localInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function StagePill({ s: st }: { s: string }) {
  const [, label, tone, dot] = stageOf(st);
  return <Pill tone={tone} dot={dot !== false}>{label}</Pill>;
}

export function Avatar({ name, size = 30 }: { name: string; size?: number }) {
  return <div className="ava" style={{ width: size, height: size, fontSize: size < 34 ? 11 : 12 }}>{initials(name)}</div>;
}

const SERVICE_TYPE: Record<string, ProductType> = {
  hotels: "hotel", excursions: "excursion", packages: "package", umrah: "umrah", transfers: "transfer", cars: "car", visa: "visa", flights: "flight",
};

type Fields = { status: string; assigned_to: string; travel_date: string; travellers: string; budget: string; quote_amount: string; follow_up_at: string; close_reason: string };
const fieldsOf = (e: EnquiryDetail): Fields => ({
  status: e.status, assigned_to: e.assigned_to ?? "", travel_date: e.travel_date ?? "", travellers: s(e.travellers), budget: s(e.budget),
  quote_amount: s(e.quote_amount), follow_up_at: localInput(e.follow_up_at), close_reason: e.close_reason ?? "",
});

export function EnquiryDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged?: () => void }) {
  const { data: e, error, setData } = useData<EnquiryDetail>(id ? `/enquiries/${id}` : null);
  const staff = useData<Staff[]>(id ? "/bookings/staff" : null);
  const [f, setF] = useState<Fields | null>(null);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [modal, setModal] = useState<null | "convert" | "close">(null);
  const toast = useToast();

  useEffect(() => {
    // Reset the editable fields and reply box when another enquiry loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setF(e ? fieldsOf(e) : null);
  }, [e]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReply(e ? `Assalam o Alaikum ${e.name.split(" ")[0]}, thank you for contacting Sky Holidays. ` : "");
    setNote("");
  }, [e?.id, e?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!id) return <Drawer open={false} onClose={onClose} head={null}>{null}</Drawer>;
  if (!e || !f) return <Drawer open onClose={onClose} head={<b>Enquiry</b>}>{error ? <ErrorNote error={error} /> : <Loading />}</Drawer>;

  const changed = (d: EnquiryDetail) => { setData(d); onChanged?.(); };
  async function run(label: string, fn: () => Promise<EnquiryDetail>, ok: string) {
    setBusy(label);
    try { changed(await fn()); toast(ok); return true; } catch (x) { toast((x as Error).message, "bad"); return false; } finally { setBusy(""); }
  }

  const base = fieldsOf(e);
  const dirty = (Object.keys(f) as (keyof Fields)[]).some((k) => f[k] !== base[k]);
  const save = () => {
    const body: Record<string, unknown> = {};
    for (const k of Object.keys(f) as (keyof Fields)[]) {
      if (f[k] === base[k]) continue;
      body[k] = k === "travellers" || k === "budget" || k === "quote_amount" ? num(f[k]) : k === "follow_up_at" ? (f[k] ? new Date(f[k]).toISOString() : null) : f[k] || null;
    }
    if (body.status === "closed" && !f.close_reason) { setModal("close"); return; }
    run("save", () => api.patch<EnquiryDetail>(`/enquiries/${e.id}`, body), "Enquiry updated");
  };
  const set = (k: keyof Fields, v: string) => setF({ ...f, [k]: v });
  const sendEmail = (body: string, ok: string, subject?: string) => run("reply", () => api.post<EnquiryDetail>(`/enquiries/${e.id}/reply`, { body, via: "email", subject }), ok);
  const logWhatsApp = (body: string) => {
    window.open(waLink(e.phone, body), "_blank", "noopener");
    run("wa", () => api.post<EnquiryDetail>(`/enquiries/${e.id}/reply`, { body, via: "whatsapp" }), "Logged the WhatsApp reply");
  };
  const quote = Number(f.quote_amount.replace(/,/g, "")) || 0;
  const quoteText = `Assalam o Alaikum ${e.name.split(" ")[0]}, thank you for your patience. Our quote for your ${serviceLabel(e.service).toLowerCase()} request`
    + `${e.travellers ? ` for ${e.travellers} traveller${e.travellers > 1 ? "s" : ""}` : ""}${f.travel_date ? ` on ${date(f.travel_date)}` : ""} is ${pkr(quote)} in total. `
    + "Reply here or call us to confirm and we will hold the booking for you.";
  async function sendQuote() {
    if (!quote) { toast("Enter the quote amount first", "bad"); return; }
    const body: Record<string, unknown> = { quote_amount: quote };
    if (["new", "contacted"].includes(e!.status)) body.status = "quoted";
    if (!(await run("quote", () => api.patch<EnquiryDetail>(`/enquiries/${e!.id}`, body), "Quote saved"))) return;
    if (e!.email) await sendEmail(quoteText, `Quote emailed to ${e!.email}`, "Your quote from Sky Holidays");
    else logWhatsApp(quoteText);
  }
  const open = e.status !== "converted" && e.status !== "closed";

  return (
    <>
      <Drawer open onClose={onClose} label={`Enquiry from ${e.name}`}
        head={<>
          <div className="row"><Pill tone="gold" dot={false}>{serviceLabel(e.service)}</Pill><StagePill s={e.status} />{e.booking_ref && <Pill tone="good" dot={false}>{e.booking_ref}</Pill>}</div>
          <h2 style={{ fontSize: 26, marginTop: 6 }}>{e.name}</h2>
          <div className="t2" style={{ color: "var(--muted)" }}>{channelLabel(e.channel)} · {ago(e.created_at)} · <span className="tab">{e.phone}</span>{e.email ? ` · ${e.email}` : ""}</div>
        </>}
        foot={<>
          {e.can.convert && !e.booking_id && <Btn variant="gold" icon="ticket" onClick={() => setModal("convert")}>Convert to booking</Btn>}
          {e.booking_ref && <Link className="btn btn-gold" href={`/admin/bookings/all?open=${e.booking_ref}`}><span>Open booking {e.booking_ref}</span></Link>}
          {e.can.edit && <Btn icon="send" busy={busy === "reply"} disabled={!e.email} title={e.email ? undefined : "No email address on this enquiry"} onClick={() => sendEmail(reply, `Reply emailed to ${e.email}`)}>Send reply</Btn>}
          {e.can.edit && <Btn icon="whats" busy={busy === "wa"} onClick={() => logWhatsApp(reply)}>WhatsApp</Btn>}
          {e.can.edit && open && <Btn icon="file" busy={busy === "quote"} onClick={sendQuote}>Send quote</Btn>}
          <span className="spacer" />
          {e.can.edit && open && <Btn variant="ghost" onClick={() => setModal("close")}>Close enquiry</Btn>}
        </>}
      >
        <div className="panel" style={{ padding: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Message</h3>
          <p style={{ margin: 0, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{e.message || "No message."}</p>
          {e.product && <div className="t2" style={{ marginTop: 10, color: "var(--muted)" }}>Asked about: <b>{e.product}</b></div>}
        </div>

        <div className="f-grid">
          <Field label="Stage">
            <Select value={f.status} disabled={!e.can.edit} onChange={(x) => set("status", x.target.value)}
              options={STAGES.filter(([k]) => k !== "converted" || e.booking_id).map(([value, label]) => ({ value, label }))} />
          </Field>
          <Field label="Assigned to">
            <Select value={f.assigned_to} disabled={!e.can.edit} placeholder="Nobody yet" onChange={(x) => set("assigned_to", x.target.value)}
              options={(staff.data ?? []).map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))} />
          </Field>
          <Field label="Travel date"><Input type="date" disabled={!e.can.edit} value={f.travel_date} onChange={(x) => set("travel_date", x.target.value)} /></Field>
          <Field label="Travellers"><Input type="number" min={0} disabled={!e.can.edit} value={f.travellers} onChange={(x) => set("travellers", x.target.value)} /></Field>
          <Field label="Budget"><PreInput pre="PKR" inputMode="decimal" disabled={!e.can.edit} value={f.budget} onChange={(x) => set("budget", x.target.value)} /></Field>
          <Field label="Quote amount"><PreInput pre="PKR" inputMode="decimal" disabled={!e.can.edit} value={f.quote_amount} onChange={(x) => set("quote_amount", x.target.value)} /></Field>
          <Field label="Follow up on"><Input type="datetime-local" disabled={!e.can.edit} value={f.follow_up_at} onChange={(x) => set("follow_up_at", x.target.value)} /></Field>
          {(f.status === "closed" || e.close_reason) && <Field label="Close reason"><Input disabled={!e.can.edit} value={f.close_reason} onChange={(x) => set("close_reason", x.target.value)} /></Field>}
          {dirty && <div className="span-all row" style={{ justifyContent: "flex-end" }}>
            <Btn variant="ghost" size="sm" onClick={() => setF(base)}>Discard</Btn>
            <Btn variant="gold" size="sm" icon="check" busy={busy === "save"} onClick={save}>Save changes</Btn>
          </div>}
          {e.can.edit && (
            <Field label="Reply" className="span-all" hint={e.email ? "Send reply emails the guest; WhatsApp opens a chat with this text." : "No email on this enquiry. Use WhatsApp."}>
              <Textarea value={reply} onChange={(x) => setReply(x.target.value)} style={{ minHeight: 90 }} />
            </Field>
          )}
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <div className="panel-h"><h3>Conversation</h3></div>
          {e.can.edit && (
            <div className="row" style={{ marginBottom: 14, flexWrap: "nowrap" }}>
              <Input placeholder="Add an internal note" value={note} onChange={(x) => setNote(x.target.value)}
                onKeyDown={(x) => { if (x.key === "Enter" && note.trim()) run("note", () => api.post<EnquiryDetail>(`/enquiries/${e.id}/notes`, { body: note }), "Note added").then((ok) => ok && setNote("")); }} />
              <Btn size="sm" busy={busy === "note"} disabled={!note.trim()} onClick={() => run("note", () => api.post<EnquiryDetail>(`/enquiries/${e.id}/notes`, { body: note }), "Note added").then((ok) => ok && setNote(""))}>Add note</Btn>
            </div>
          )}
          <ul className="timeline">
            {e.notes.map((n) => (
              <li key={n.id}>
                <span className={cx("dt", n.kind === "reply" ? "s" : n.kind === "status" ? "" : "g")} />
                <div style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{n.kind === "note" ? "Note: " : ""}{n.body}</b>
                  {n.user_name && <><br /><small>{n.user_name}</small></>}
                </div>
                <small title={dateTime(n.created_at)}>{ago(n.created_at)}</small>
              </li>
            ))}
            <li><span className="dt s" /><div><b style={{ fontSize: 13 }}>Enquiry received</b><br /><small>{channelLabel(e.channel)}</small></div><small>{ago(e.created_at)}</small></li>
          </ul>
        </div>
      </Drawer>

      {modal === "close" && <CloseModal e={e} reason={f.close_reason} onClose={() => setModal(null)} onDone={(d) => { setModal(null); changed(d); }} />}
      {modal === "convert" && <ConvertModal e={e} quote={quote} travelDate={f.travel_date} onClose={() => setModal(null)} onDone={(d) => { setModal(null); changed(d); }} />}
    </>
  );
}

function CloseModal({ e, reason, onClose, onDone }: { e: EnquiryDetail; reason: string; onClose: () => void; onDone: (d: EnquiryDetail) => void }) {
  const [r, setR] = useState(reason || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const presets = ["Booked elsewhere", "Price too high", "No reply from guest", "Dates not available", "Just asking"];
  async function go() {
    setBusy(true); setErr(null);
    try { onDone(await api.patch<EnquiryDetail>(`/enquiries/${e.id}`, { status: "closed", close_reason: r || null })); toast("Enquiry closed"); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={`Close ${e.name}'s enquiry`} foot={<><Btn variant="ghost" onClick={onClose}>Keep open</Btn><Btn variant="gold" busy={busy} onClick={go}>Close enquiry</Btn></>}>
      <Field label="Reason">
        <Select value={presets.includes(r) ? r : r ? "__other" : ""} placeholder="Pick a reason" onChange={(x) => setR(x.target.value === "__other" ? " " : x.target.value)}
          options={[...presets.map((p) => ({ value: p, label: p })), { value: "__other", label: "Something else" }]} />
      </Field>
      {!presets.includes(r) && r !== "" && <Field label="Describe it"><Input value={r.trim()} onChange={(x) => setR(x.target.value || " ")} /></Field>}
      <ErrorNote error={err} />
    </Modal>
  );
}

type Product = { id: string; name: string; sub: string | null; price: number | null };

function ConvertModal({ e, quote, travelDate, onClose, onDone }: { e: EnquiryDetail; quote: number; travelDate: string; onClose: () => void; onDone: (d: EnquiryDetail) => void }) {
  const [f, setF] = useState({
    product_type: SERVICE_TYPE[e.service.toLowerCase()] ?? "other" as ProductType, product_id: e.ref_id as string | null, product_name: e.product ?? "",
    start_date: travelDate || "", end_date: "", adults: String(Math.max(e.travellers ?? 1, 1)), children: "0", total_amount: quote ? String(quote) : "",
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => {
    if (["flight", "other"].includes(f.product_type) || f.product_id) return;
    let live = true;
    const t = setTimeout(() => api.get<Product[]>(`/bookings/products?type=${f.product_type}&q=${encodeURIComponent(f.product_name)}`).then((p) => live && setProducts(p)).catch(() => {}), 180);
    return () => { live = false; clearTimeout(t); };
  }, [f.product_type, f.product_name, f.product_id]);
  async function go() {
    setBusy(true); setErr(null);
    try {
      const out = await api.post<{ booking: { id: string; ref: string }; enquiry: EnquiryDetail }>(`/enquiries/${e.id}/convert`, {
        product_type: f.product_type, product_id: f.product_id, product_name: f.product_name || undefined, start_date: f.start_date || undefined,
        end_date: f.end_date || null, adults: Number(f.adults) || 1, children: Number(f.children) || 0, total_amount: f.total_amount ? Number(f.total_amount.replace(/,/g, "")) : undefined,
      });
      toast(`Booking ${out.booking.ref} created`);
      onDone(out.enquiry);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} wide title="Convert to booking" foot={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="gold" icon="ticket" busy={busy} onClick={go}>Create booking</Btn></>}>
      <p className="muted" style={{ margin: 0 }}>Creates a booking for {e.name} in Awaiting payment, linked to this enquiry. You can add travellers and payments on the booking.</p>
      <div className="f-grid">
        <Field label="Product type"><Select value={f.product_type} onChange={(x) => setF({ ...f, product_type: x.target.value as ProductType, product_id: null })} options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="Product" hint={f.product_id ? "Linked to the catalogue" : "Pick from the list or type a name"}><Input value={f.product_name} placeholder="Search by name" onChange={(x) => setF({ ...f, product_name: x.target.value, product_id: null })} /></Field>
        {!f.product_id && products.length > 0 && f.product_name && (
          <div className="span-all ops-picks">
            {products.slice(0, 8).map((p) => <button key={p.id} type="button" className="chip" onClick={() => setF({ ...f, product_id: p.id, product_name: p.name, total_amount: f.total_amount || (p.price ? String(p.price) : "") })}>{p.name}{p.sub && <span className="n">{p.sub}</span>}</button>)}
          </div>
        )}
        <Field label="Start date"><Input type="date" value={f.start_date} onChange={(x) => setF({ ...f, start_date: x.target.value })} /></Field>
        <Field label="End date"><Input type="date" value={f.end_date} onChange={(x) => setF({ ...f, end_date: x.target.value })} /></Field>
        <Field label="Adults"><Input type="number" min={1} value={f.adults} onChange={(x) => setF({ ...f, adults: x.target.value })} /></Field>
        <Field label="Children"><Input type="number" min={0} value={f.children} onChange={(x) => setF({ ...f, children: x.target.value })} /></Field>
        <Field label="Total" className="span-all"><PreInput pre="PKR" inputMode="decimal" value={f.total_amount} onChange={(x) => setF({ ...f, total_amount: x.target.value })} /></Field>
      </div>
      <ErrorNote error={err} />
    </Modal>
  );
}

/* ---------- log enquiry ---------- */

export function LogEnquiryModal({ onClose, onSaved }: { onClose: () => void; onSaved: (e: EnquiryDetail) => void }) {
  const staff = useData<Staff[]>("/bookings/staff");
  const [f, setF] = useState({ service: "umrah", name: "", phone: "", email: "", channel: "phone", travel_date: "", travellers: "", budget: "", message: "", assigned_to: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  async function go() {
    setBusy(true); setErr(null);
    try {
      const d = await api.post<EnquiryDetail>("/enquiries", {
        ...f, email: f.email || null, travel_date: f.travel_date || null, travellers: f.travellers ? Number(f.travellers) : null,
        budget: f.budget ? Number(f.budget.replace(/,/g, "")) : null, assigned_to: f.assigned_to || null, message: f.message || null,
      });
      toast("Enquiry logged");
      onSaved(d);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} wide title="Log enquiry" foot={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="gold" icon="check" busy={busy} onClick={go}>Log enquiry</Btn></>}>
      <div className="f-grid">
        <Field label="Guest name"><Input value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} /></Field>
        <Field label="Phone / WhatsApp"><Input value={f.phone} placeholder="+92 300 0000000" onChange={(x) => setF({ ...f, phone: x.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={f.email} onChange={(x) => setF({ ...f, email: x.target.value })} /></Field>
        <Field label="Came in by"><Select value={f.channel} onChange={(x) => setF({ ...f, channel: x.target.value })} options={CHANNELS.map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="Service"><Select value={f.service} onChange={(x) => setF({ ...f, service: x.target.value })} options={SERVICES.map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="Assigned to"><Select value={f.assigned_to} placeholder="Nobody yet" onChange={(x) => setF({ ...f, assigned_to: x.target.value })} options={(staff.data ?? []).map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))} /></Field>
        <Field label="Travel date"><Input type="date" value={f.travel_date} onChange={(x) => setF({ ...f, travel_date: x.target.value })} /></Field>
        <Field label="Travellers"><Input type="number" min={0} value={f.travellers} onChange={(x) => setF({ ...f, travellers: x.target.value })} /></Field>
        <Field label="Budget"><PreInput pre="PKR" inputMode="decimal" value={f.budget} onChange={(x) => setF({ ...f, budget: x.target.value })} /></Field>
        <Field label="What they asked" className="span-all"><Textarea value={f.message} onChange={(x) => setF({ ...f, message: x.target.value })} /></Field>
      </div>
      <ErrorNote error={err} />
    </Modal>
  );
}

/** Assigns every unassigned open enquiry to one person (board "Assign" button). */
export function AssignModal({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone: () => void }) {
  const staff = useData<Staff[]>("/bookings/staff");
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  async function go() {
    if (!who) { setErr("Pick a person"); return; }
    setBusy(true); setErr(null);
    try {
      for (const id of ids) await api.patch(`/enquiries/${id}`, { assigned_to: who });
      toast(`${ids.length} enquir${ids.length === 1 ? "y" : "ies"} assigned`);
      onDone();
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title="Assign open enquiries" foot={<><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn variant="gold" busy={busy} disabled={!ids.length} onClick={go}>Assign</Btn></>}>
      <p className="muted" style={{ margin: 0 }}>{ids.length ? `${ids.length} open enquir${ids.length === 1 ? "y has" : "ies have"} nobody assigned.` : "Every open enquiry already has someone assigned."}</p>
      <Field label="Assign to"><Select value={who} placeholder="Pick a person" onChange={(x) => setWho(x.target.value)} options={(staff.data ?? []).map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))} /></Field>
      <ErrorNote error={err} />
    </Modal>
  );
}
