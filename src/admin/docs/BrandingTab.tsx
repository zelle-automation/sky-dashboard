"use client";
/* eslint-disable @next/next/no-img-element -- previews of uploaded brand images */
// Documents → Logo, header & footer: voucher brand (name, slogan, cover, logos, footer pills)
// and the letterhead images used by invoices, quotations, visa letters and receipts.
import { useEffect, useState } from "react";
import { api, useData } from "@/admin/api";
import { useCan } from "@/admin/shell";
import { Btn, Check, ErrorNote, Field, ImageUpload, Input, Loading, PageHead, Panel, PreInput, SaveBar, SwitchRow, useToast } from "@/admin/ui";
import { DEFAULT_BRANDING, type Branding } from "./defaults";
import { HotelVoucher, InvoiceDoc, SAMPLE_DOC, type DocConfig } from "./render";

export function BrandingTab() {
  const cfg = useData<DocConfig>("/documents/config");
  const canEdit = useCan("documents.branding", "edit");
  const toast = useToast();
  const [b, setB] = useState<Branding | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [view, setView] = useState<"voucher" | "letterhead">("voucher");
  useEffect(() => {
    // Copy the saved branding into the form once loaded.
    if (cfg.data && !b) setB(cfg.data.branding);
  }, [cfg.data, b]);
  if (cfg.error) return <ErrorNote error={cfg.error} />;
  if (!b || !cfg.data) return <Loading />;
  const saved = cfg.data.branding;
  const dirty = JSON.stringify(b) !== JSON.stringify(saved);
  const set = (p: Partial<Branding>) => setB({ ...b, ...p });
  const docCfg: DocConfig = { ...cfg.data, branding: b };

  async function save() {
    setBusy(true); setErr(null);
    try {
      const next = await api.put<Branding>("/documents/branding", b);
      cfg.setData({ ...cfg.data!, branding: next });
      setB(next);
      toast("Saved. Every document now uses these.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const img = (key: keyof Branding, label: string, hint: string, aspect: string, contain = true, dark = false) => (
    <div className="grid" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div><b style={{ fontSize: 13 }}>{label}</b><div className="muted" style={{ fontSize: 12 }}>{hint}</div></div>
        {canEdit && b[key] !== DEFAULT_BRANDING[key] && <Btn size="sm" variant="ghost" onClick={() => set({ [key]: DEFAULT_BRANDING[key] } as Partial<Branding>)}>Use default</Btn>}
      </div>
      <div className={dark ? "br-img br-dark" : contain ? "br-img br-light" : "br-img"}>
        {canEdit ? (
          <ImageUpload value={String(b[key] || "")} onChange={(u) => set({ [key]: u ?? "" } as Partial<Branding>)} folder="branding" aspect={aspect} contain={contain} label={`Upload ${label.toLowerCase()}`} />
        ) : b[key] ? <img src={String(b[key])} alt={label} className="wide-prv" /> : <div className="drop">No image</div>}
      </div>
    </div>
  );

  return (
    <>
      <PageHead eyebrow="Documents" title="Logo, header & footer" sub="Everything here is editable. Upload a new image or change the text and the preview updates straight away. Save to use it on every document." >
        {canEdit && <Btn variant="gold" icon="check" busy={busy} disabled={!dirty} onClick={save}>Save</Btn>}
      </PageHead>
      <ErrorNote error={err} />
      <div className="doc-layout doc-layout-even">
        <fieldset disabled={!canEdit} className="grid" style={{ alignContent: "start", border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <Panel title="Voucher design" label="Hotel & transfer vouchers">
            <div className="grid">
              <div className="g-2 grid">
                {img("logo_url", "Logo", "Top right of the cover. PNG with a transparent background.", "3/2")}
                {img("logo_white_url", "Footer logo", "Light version for the dark footer band.", "3/2", true, true)}
              </div>
              {img("cover_url", "Cover image", "2480 × 1020 px. Keep the left third dark for the title.", "2480/1020", false)}
              <div className="f-grid">
                <Field label="Company name"><Input value={b.name} onChange={(e) => set({ name: e.target.value })} /></Field>
                <Field label="Slogan"><Input value={b.slogan} onChange={(e) => set({ slogan: e.target.value })} /></Field>
                <Field label="Footer phone"><Input value={b.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
                <Field label="Footer email"><Input value={b.email} onChange={(e) => set({ email: e.target.value })} /></Field>
                <Field label="Footer website" className="span-all"><Input value={b.web} onChange={(e) => set({ web: e.target.value })} /></Field>
              </div>
              <div>
                <div className="lab muted" style={{ fontSize: 11.5, fontWeight: 700 }}>Footer contact pills</div>
                <SwitchRow title="Phone" checked={b.pills.phone} onChange={(v) => set({ pills: { ...b.pills, phone: v } })} disabled={!canEdit} />
                <SwitchRow title="Email" checked={b.pills.email} onChange={(v) => set({ pills: { ...b.pills, email: v } })} disabled={!canEdit} />
                <SwitchRow title="Website" checked={b.pills.web} onChange={(v) => set({ pills: { ...b.pills, web: v } })} disabled={!canEdit} />
              </div>
            </div>
          </Panel>
          <Panel title="Letterhead" label="Invoice, quotation, visa letter, receipt">
            <div className="grid">
              {img("lh_header_url", "Header image", "Stretches to the full A4 width (210 mm). Best size 2480 × 350 px.", "2480/350", false)}
              {img("lh_footer_url", "Footer image", "Full A4 width, sits at the bottom of every page. Best size 2480 × 200 px.", "2480/200", false)}
              <div className="fld">
                <span className="lab">Use the letterhead on</span>
                <div className="row" style={{ gap: 18 }}>
                  {([["invoice", "Invoice"], ["quotation", "Quotation"], ["visa-letter", "Visa letter"], ["receipt", "Receipt"]] as const).map(([k, l]) => (
                    <Check key={k} label={l} checked={b.letterhead_on[k]} disabled={!canEdit} onChange={(v) => set({ letterhead_on: { ...b.letterhead_on, [k]: v } })} />
                  ))}
                </div>
              </div>
              {img("stamp_url", "Signature & company stamp", "Added to visa letters and receipts. PNG with a transparent background.", "1/1")}
              <div className="f-grid">
                <Field label="Space below header"><PreInput pre="mm" type="number" min={0} max={60} value={b.lh_space_mm} onChange={(e) => set({ lh_space_mm: Number(e.target.value) })} /></Field>
                <Field label="Side margins"><PreInput pre="mm" type="number" min={5} max={40} value={b.lh_side_mm} onChange={(e) => set({ lh_side_mm: Number(e.target.value) })} /></Field>
              </div>
            </div>
          </Panel>
        </fieldset>
        <div style={{ minWidth: 0, position: "sticky", top: 96, alignSelf: "start" }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <b style={{ fontSize: 13 }}>Live preview</b>
            <span style={{ flex: 1 }} />
            <Btn size="sm" variant={view === "voucher" ? "gold" : "plain"} onClick={() => setView("voucher")}>Voucher</Btn>
            <Btn size="sm" variant={view === "letterhead" ? "gold" : "plain"} onClick={() => setView("letterhead")}>Letterhead</Btn>
          </div>
          {view === "voucher" ? <HotelVoucher d={SAMPLE_DOC} cfg={docCfg} /> : <InvoiceDoc d={SAMPLE_DOC} cfg={docCfg} />}
        </div>
      </div>
      {canEdit && <SaveBar dirty={dirty} busy={busy} onSave={save} onReset={() => setB(saved)} />}
    </>
  );
}
