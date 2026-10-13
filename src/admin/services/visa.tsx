"use client";
// Visa services shown on the site's Visa page.
import { useState } from "react";
import { api, useData } from "../api";
import { money } from "../format";
import { useCan } from "../shell";
import { Btn, Drawer, Empty, ErrorNote, Field, Input, Loading, PageHead, Panel, Pill, Select, SwitchRow, Tags, useToast } from "../ui";
import { LiveSwitch, move, NumInput, numStr, OrderBtns, rowProps, toNum, useAction, useDelete, useForm } from "./common";

type Visa = {
  id: string; country_iso2: string; country: string; flag_emoji: string | null; visa_type: string; entry: "single" | "multiple"; stay_days: number | null;
  processing_days: string | null; price_from: number | null; currency_code: string; is_evisa: boolean; requirements: string[]; sort_order: number;
  is_published: boolean; in_progress: number;
};

export function VisaPage() {
  const { data, error, loading, reload, setData } = useData<Visa[]>("/visa");
  const canCreate = useCan("visa.main", "create");
  const canEdit = useCan("visa.main", "edit");
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const rows = data ?? [];
  async function reorder(from: number, to: number) {
    const next = move(rows, from, to);
    setData(next);
    try { await api.put("/visa/order/all", { ids: next.map((v) => v.id) }); toast("Order saved"); } catch (e) { toast((e as Error).message, "bad"); reload(); }
  }
  return (
    <>
      <PageHead eyebrow="Catalogue" title="Visa services" sub="Visa products shown on the Visa page. Price is the Sky Holidays service fee including the government fee.">
        {canCreate && <Btn variant="gold" icon="plus" onClick={() => setOpen("new")}>Add visa</Btn>}
      </PageHead>
      <ErrorNote error={error} />
      {loading && !data ? <Loading /> : (
        <Panel>
          {!rows.length ? <Empty icon="passport" title="No visa services yet" /> : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Country</th><th>Visa</th><th>Type</th><th>Entry</th><th>Stay</th><th>Processing</th><th className="num">Price</th><th>In progress</th><th>Live</th>{canEdit && <th>Order</th>}</tr></thead>
                <tbody>
                  {rows.map((v, i) => (
                    <tr key={v.id} {...rowProps(() => setOpen(v.id))}>
                      <td><div className="row" style={{ flexWrap: "nowrap" }}><span style={{ fontSize: 18 }}>{v.flag_emoji}</span><b>{v.country}</b></div></td>
                      <td>{v.visa_type}<div className="t2">{v.requirements.length} documents</div></td>
                      <td><Pill tone={v.is_evisa ? "sig" : "info"}>{v.is_evisa ? "e-visa" : "Embassy"}</Pill></td>
                      <td>{v.entry === "multiple" ? "Multiple" : "Single"}</td>
                      <td className="tab">{v.stay_days ? `${v.stay_days} days` : "–"}</td>
                      <td className="tab">{v.processing_days ?? "–"}</td>
                      <td className="num tab"><b>{v.price_from ? money(v.price_from, v.currency_code) : "In package"}</b></td>
                      <td className="tab">{v.in_progress} {v.in_progress === 1 ? "application" : "applications"}</td>
                      <td><LiveSwitch on={v.is_published} label={`${v.country} ${v.visa_type}`} path={`/visa/${v.id}`} field="is_published" disabled={!canEdit} onDone={(val) => setData((d) => d && d.map((x) => (x.id === v.id ? { ...x, is_published: val } : x)))} /></td>
                      {canEdit && <td><OrderBtns i={i} n={rows.length} onMove={reorder} /></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      <Drawer open={!!open} onClose={() => setOpen(null)} label="Visa" head={<h2 style={{ fontSize: 24 }}>{open === "new" ? "New visa" : (() => { const v = rows.find((r) => r.id === open); return v ? `${v.country} · ${v.visa_type}` : ""; })()}</h2>}>
        {open && <VisaForm key={open} v={rows.find((r) => r.id === open) ?? null} onClose={() => setOpen(null)} onSaved={reload} />}
      </Drawer>
    </>
  );
}

function VisaForm({ v, onClose, onSaved }: { v: Visa | null; onClose: () => void; onSaved: () => void }) {
  const countries = useData<{ iso2: string; name: string; flag_emoji: string | null }[]>("/visa/countries");
  const { f, set } = useForm({
    country_iso2: v?.country_iso2 ?? "AE", visa_type: v?.visa_type ?? "", entry: v?.entry ?? "single", stay_days: numStr(v?.stay_days), processing_days: v?.processing_days ?? "",
    price_from: numStr(v?.price_from), currency_code: v?.currency_code ?? "PKR", is_evisa: v?.is_evisa ?? true, requirements: v?.requirements ?? ["Passport valid 6 months", "Passport-size photo", "CNIC copy"],
    is_published: v?.is_published ?? true,
  });
  const canSave = useCan("visa.main", v ? "edit" : "create");
  const canDelete = useCan("visa.main", "delete");
  const { busy, run } = useAction();
  const del = useDelete();
  async function save() {
    const body = { ...f, stay_days: toNum(f.stay_days), price_from: toNum(f.price_from), processing_days: f.processing_days || null };
    const out = await run(() => (v ? api.put(`/visa/${v.id}`, body) : api.post("/visa", body)), v ? "Visa saved" : "Visa added");
    if (out) { onSaved(); onClose(); }
  }
  return (
    <>
      <div className="f-grid">
        <Field label="Country"><Select value={f.country_iso2} onChange={(e) => set("country_iso2")(e.target.value)} options={(countries.data ?? [{ iso2: f.country_iso2, name: f.country_iso2, flag_emoji: null }]).map((c) => ({ value: c.iso2, label: `${c.flag_emoji ?? ""} ${c.name}`.trim() }))} /></Field>
        <Field label="Visa" hint="e.g. 30-day tourist"><Input value={f.visa_type} onChange={(e) => set("visa_type")(e.target.value)} /></Field>
        <Field label="Entry"><Select value={f.entry} onChange={(e) => set("entry")(e.target.value as "single" | "multiple")} options={[{ value: "single", label: "Single entry" }, { value: "multiple", label: "Multiple entry" }]} /></Field>
        <Field label="Stay"><NumInput value={f.stay_days} onChange={set("stay_days")} pre="days" /></Field>
        <Field label="Processing" hint="e.g. 3–5 working days"><Input value={f.processing_days} onChange={(e) => set("processing_days")(e.target.value)} /></Field>
        <Field label="Price" hint="Leave empty or 0 when it comes with a package"><NumInput value={f.price_from} onChange={set("price_from")} pre={f.currency_code} /></Field>
        <Field label="Documents needed" className="span-all"><Tags value={f.requirements} onChange={set("requirements")} placeholder="e.g. Bank statement" /></Field>
      </div>
      <div>
        <SwitchRow title="e-visa" sub="Off means it goes through the embassy" checked={f.is_evisa} onChange={set("is_evisa")} />
        <SwitchRow title="Live on the website" checked={f.is_published} onChange={set("is_published")} />
      </div>
      <div className="row svc-foot">
        {canSave && <Btn variant="gold" icon="check" busy={busy} onClick={save}>{v ? "Save visa" : "Add visa"}</Btn>}
        <span style={{ flex: 1 }} />
        {v && canDelete && <Btn variant="danger" icon="trash" onClick={async () => { if (await del(`/visa/${v.id}`, "this visa")) { onSaved(); onClose(); } }}>Delete</Btn>}
      </div>
    </>
  );
}
