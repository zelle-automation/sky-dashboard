"use client";
// Documents → Quotation: start from an enquiry or a blank page, edit the options and prices,
// save it (gets a QUO number), then print or email it.
import { useEffect, useRef, useState } from "react";
import { api, useData } from "@/admin/api";
import { ago, date, money } from "@/admin/format";
import { useCan } from "@/admin/shell";
import { Btn, ErrorNote, Field, IconBtn, Input, Loading, PageHead, Panel, PreInput, Search, Select, Textarea, useConfirm, useToast } from "@/admin/ui";
import { EmailDocModal, TextsPanel, useDocTexts } from "./DocumentsTab";
import { QuotationDoc, type DocConfig, type Quote } from "./render";
import { printDoc, standaloneHtml } from "./tools";

type Enq = { id: string; name: string; phone: string; email: string | null; service: string; message: string | null; travellers: number | null; travel_date: string | null; status: string; quote_amount: number | null; created_at: string };
type QRow = { id: string; number: string; customer_name: string; summary: string | null; created_at: string; top_price: number | null };

const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const blank = (included: string): Quote => ({
  customer_name: "", customer_phone: "", customer_email: "", summary: "", price_label: "Per person", col1_label: "Details", col2_label: "",
  items: [{ title: "Option A", details: "", details2: "", price: 0 }], included, valid_until: plusDays(7), currency_code: "PKR",
});
const SERVICE: Record<string, string> = { hotels: "Hotel", excursions: "Excursion", packages: "Package", umrah: "Umrah", visa: "Visa", flights: "Flights", cars: "Car rental", transfers: "Transfer", general: "Trip" };

function fromRow(r: Record<string, unknown>): Quote {
  return {
    id: r.id as string, number: r.number as string, enquiry_id: (r.enquiry_id as string) ?? null, customer_name: String(r.customer_name ?? ""), customer_phone: String(r.customer_phone ?? ""),
    customer_email: String(r.customer_email ?? ""), summary: String(r.summary ?? ""), price_label: String(r.price_label ?? "Per person"), col1_label: String(r.col1_label ?? "Details"),
    col2_label: String(r.col2_label ?? ""), items: (r.items as Quote["items"]) ?? [], included: String(r.included ?? ""), valid_until: String(r.valid_until ?? ""),
    currency_code: String(r.currency_code ?? "PKR"), created_at: r.created_at as string, created_by_name: (r.created_by_name as string) ?? undefined,
  };
}

export function QuotationTab({ label, initialEnquiry }: { label: string; initialEnquiry: string | null }) {
  const cfg = useData<DocConfig>("/documents/config");
  const { texts, setTexts, saved, setSaved } = useDocTexts(cfg.data);
  const quotes = useData<QRow[]>("/documents/quotations");
  const [q, setQ] = useState<Quote | null>(null);
  const [eq, setEq] = useState("");
  const [term, setTerm] = useState("");
  const enqs = useData<Enq[]>(`/documents/enquiries${term ? `?q=${encodeURIComponent(term)}` : ""}`);
  const canCreate = useCan("documents.quotation", "create");
  const canEdit = useCan("documents.quotation", "edit");
  const canDelete = useCan("documents.quotation", "delete");
  const toast = useToast();
  const confirm = useConfirm();
  const pageRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mail, setMail] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTerm(eq.trim()), 250);
    return () => clearTimeout(t);
  }, [eq]);
  useEffect(() => {
    // Start with a blank quote once the default texts are loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!q && cfg.data) setQ(blank(cfg.data.texts.quoteIncluded));
  }, [q, cfg.data]);

  const set = (patch: Partial<Quote>) => { setQ((x) => (x ? { ...x, ...patch } : x)); setDirty(true); };
  const setItem = (i: number, patch: Partial<Quote["items"][number]>) => q && set({ items: q.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });

  function applyEnquiry(e: Enq) {
    const base = blank(cfg.data?.texts.quoteIncluded ?? "");
    const who = e.travellers ? `${e.travellers} traveller${e.travellers > 1 ? "s" : ""}` : "";
    setQ({
      ...base, enquiry_id: e.id, customer_name: e.name, customer_phone: e.phone, customer_email: e.email ?? "",
      summary: [SERVICE[e.service] ?? e.service, who, e.travel_date ? `from ${date(e.travel_date)}` : ""].filter(Boolean).join(", "),
      items: [{ title: "Option A", details: (e.message ?? "").slice(0, 160), details2: "", price: e.quote_amount ?? 0 }],
    });
    setDirty(true);
  }
  useEffect(() => {
    if (!initialEnquiry || !enqs.data || !cfg.data) return;
    const e = enqs.data.find((x) => x.id === initialEnquiry);
    // Prefill from ?enquiry=<id> once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (e && q && !q.enquiry_id && !q.id) applyEnquiry(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEnquiry, enqs.data, cfg.data]);

  async function open(id: string) {
    if (!id) { setQ(blank(cfg.data?.texts.quoteIncluded ?? "")); setDirty(false); return; }
    try { setQ(fromRow(await api.get(`/documents/quotations/${id}`))); setDirty(false); } catch (e) { toast((e as Error).message, "bad"); }
  }
  async function save() {
    if (!q) return;
    setBusy(true); setErr(null);
    try {
      const body = { ...q, items: q.items.map((i) => ({ ...i, price: Number(i.price) || 0 })), valid_until: q.valid_until || null, customer_email: q.customer_email || null };
      const row = q.id ? await api.put<Record<string, unknown>>(`/documents/quotations/${q.id}`, body) : await api.post<Record<string, unknown>>("/documents/quotations", body);
      setQ(fromRow({ ...row, created_by_name: q.created_by_name ?? row.created_by_name }));
      setDirty(false);
      quotes.reload();
      toast(q.id ? "Quotation updated" : `Saved as ${row.number}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!q?.id) return;
    if (!(await confirm({ title: `Delete ${q.number}?`, body: "Links already emailed to the guest stop working.", confirm: "Delete", danger: true }))) return;
    try { await api.del(`/documents/quotations/${q.id}`); toast("Deleted"); quotes.reload(); open(""); } catch (e) { toast((e as Error).message, "bad"); }
  }
  async function send(to: string) {
    const el = pageRef.current?.querySelector<HTMLElement>(".a4wrap");
    if (!el || !q?.id) throw new Error("Save the quotation first");
    if (dirty) throw new Error("Save your changes first so the guest gets the latest version");
    const title = `Quotation ${q.number}`;
    return api.post<{ to: string }>("/documents/email", { tab: "quotation", quotation_id: q.id, to: to || undefined, title, html: standaloneHtml(el, title) });
  }

  const docCfg = cfg.data && texts ? { ...cfg.data, texts } : null;
  const editable = q?.id ? canEdit : canCreate;
  const total = q?.items.reduce((a, i) => Math.max(a, Number(i.price) || 0), 0) ?? 0;

  return (
    <>
      <PageHead eyebrow="Documents" title={label} sub="Printed on your letterhead. Make a quote for an enquiry or from scratch, then print or email it.">
        {canCreate && <Btn icon="send" disabled={!q?.id} title={q?.id ? undefined : "Save the quotation first"} onClick={() => setMail(true)}>Email to guest</Btn>}
        <Btn variant="gold" icon="dl" disabled={!q} onClick={() => printDoc(pageRef.current?.querySelector(".a4wrap") ?? null)}>Print / Save PDF</Btn>
      </PageHead>
      <ErrorNote error={cfg.error} />
      <div className="doc-layout">
        <div style={{ minWidth: 0 }} ref={pageRef}>{q && docCfg ? <QuotationDoc q={q} cfg={docCfg} /> : <Loading />}</div>
        <aside className="grid doc-side" style={{ alignContent: "start" }}>
          <Panel>
            <Field label="Saved quotations">
              <Select value={q?.id ?? ""} onChange={(e) => open(e.target.value)}
                options={[{ value: "", label: "New quotation" }, ...(quotes.data ?? []).map((r) => ({ value: r.id, label: `${r.number} · ${r.customer_name}${r.top_price ? ` · ${money(r.top_price)}` : ""}` }))]} />
            </Field>
            {!q?.id && (
              <div style={{ marginTop: 14 }}>
                <Field label="Start from an enquiry" hint="Fills in the guest’s details. Or just type them below.">
                  <Search value={eq} onChange={setEq} placeholder="Name, phone or message" />
                </Field>
                <div className="doc-pick">
                  {enqs.data?.slice(0, 8).map((e) => (
                    <button key={e.id} type="button" aria-pressed={q?.enquiry_id === e.id} onClick={() => applyEnquiry(e)}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ color: "var(--text)", display: "block" }} className="trunc">{e.name} <span className="faint" style={{ fontWeight: 500 }}>· {SERVICE[e.service] ?? e.service}</span></b>
                        <span className="trunc" style={{ display: "block" }}>{e.message || e.phone}</span>
                      </span>
                      <span className="faint" style={{ fontSize: 11 }}>{ago(e.created_at)}</span>
                    </button>
                  ))}
                  {enqs.data?.length === 0 && <div className="muted" style={{ padding: 10, fontSize: 12.5 }}>No open enquiries{term ? " match" : ""}.</div>}
                </div>
              </div>
            )}
          </Panel>
          {q && (
            <Panel title={q.number ?? "New quotation"}>
              <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="grid">
                <div className="f-grid">
                  <Field label="Prepared for" className="span-all"><Input value={q.customer_name} onChange={(e) => set({ customer_name: e.target.value })} placeholder="Guest name" /></Field>
                  <Field label="Phone"><Input value={q.customer_phone} onChange={(e) => set({ customer_phone: e.target.value })} /></Field>
                  <Field label="Email"><Input type="email" value={q.customer_email} onChange={(e) => set({ customer_email: e.target.value })} /></Field>
                  <Field label="Trip summary" className="span-all"><Input value={q.summary} onChange={(e) => set({ summary: e.target.value })} placeholder="Premium Umrah for 2 adults, Ramadan" /></Field>
                  <Field label="Valid until"><Input type="date" value={q.valid_until} onChange={(e) => set({ valid_until: e.target.value })} /></Field>
                  <Field label="Price column"><Select value={q.price_label} onChange={(e) => set({ price_label: e.target.value })} options={["Per person", "Total", "Per room", "Per night", "Per group"]} /></Field>
                  <Field label="Column 1 heading"><Input value={q.col1_label} onChange={(e) => set({ col1_label: e.target.value })} placeholder="Makkah" /></Field>
                  <Field label="Column 2 heading" hint="Leave empty to hide"><Input value={q.col2_label} onChange={(e) => set({ col2_label: e.target.value })} placeholder="Madinah" /></Field>
                </div>
                <div className="grid" style={{ gap: 10 }}>
                  {q.items.map((it, i) => (
                    <div className="q-item" key={i}>
                      <Input value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} aria-label="Option name" placeholder="Option name" />
                      <PreInput pre={q.currency_code} type="number" min={0} value={it.price || ""} onChange={(e) => setItem(i, { price: Number(e.target.value) })} aria-label="Price" />
                      <IconBtn icon="trash" label="Remove option" disabled={q.items.length < 2} onClick={() => set({ items: q.items.filter((_, j) => j !== i) })} />
                      <Textarea className="span-all" rows={2} value={it.details} onChange={(e) => setItem(i, { details: e.target.value })} placeholder={q.col1_label || "Details"} aria-label={q.col1_label || "Details"} />
                      {q.col2_label.trim() && <Textarea className="span-all" rows={2} value={it.details2} onChange={(e) => setItem(i, { details2: e.target.value })} placeholder={q.col2_label} aria-label={q.col2_label} />}
                    </div>
                  ))}
                  {q.items.length < 8 && <Btn size="sm" icon="plus" onClick={() => set({ items: [...q.items, { title: `Option ${String.fromCharCode(65 + q.items.length)}`, details: "", details2: "", price: 0 }] })}>Add option</Btn>}
                </div>
                <Field label="Included" hint="Shown in the tinted box under the table"><Textarea rows={3} value={q.included} onChange={(e) => set({ included: e.target.value })} /></Field>
              </fieldset>
              <ErrorNote error={err} />
              <div className="row" style={{ marginTop: 14 }}>
                {editable && <Btn variant="gold" icon="check" busy={busy} disabled={!dirty && !!q.id} onClick={save}>{q.id ? "Save changes" : "Save quotation"}</Btn>}
                {q.id && canDelete && <Btn variant="ghost" icon="trash" onClick={remove}>Delete</Btn>}
                <span className="faint" style={{ fontSize: 12, marginLeft: "auto" }}>Top price {money(total, q.currency_code)}</span>
              </div>
            </Panel>
          )}
          {texts && saved && (
            <TextsPanel tab="quotation" fields={[{ key: "quoteTerms", label: "Terms", hint: "Printed at the bottom of every quotation.", rows: 5 }, { key: "quoteIncluded", label: "Default “Included” text for new quotations", rows: 3 }]}
              texts={texts} saved={saved} onChange={setTexts} onSaved={(t) => { setTexts(t); setSaved(t); }} />
          )}
        </aside>
      </div>
      {q?.id && <EmailDocModal open={mail} onClose={() => setMail(false)} defaultTo={q.customer_email} title={`Quotation ${q.number}`} send={send} />}
    </>
  );
}
