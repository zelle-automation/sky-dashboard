"use client";
// Destinations: ordered cards for the site carousel, publish switch, editor drawer.
import { useState } from "react";
import { api, useData } from "../api";
import { siteUrl, slugify } from "../format";
import { useCan } from "../shell";
import { Btn, cx, Drawer, Empty, ErrorNote, Field, Icon, ImageUpload, Input, Loading, PageHead, Panel, Select, SwitchRow, Textarea, useToast } from "../ui";
import { LiveSwitch, move, NumInput, numStr, picVars, toNum, useAction, useDelete, useForm } from "./common";

type Dest = {
  id: string; slug: string; name: string; country_iso2: string; country_name: string; flag_emoji: string | null; category: "international" | "domestic" | "umrah";
  tagline: string | null; description: string | null; best_time: string | null; flight_note: string | null; lat: number | null; lng: number | null;
  price_from: number | null; currency_code: string; image_day_url: string | null; image_night_url: string | null; is_featured: boolean; is_published: boolean;
  sort_order: number; hotels: number; excursions: number; packages: number;
};
const CAT = { international: "International", domestic: "Domestic", umrah: "Umrah" };

export function DestinationsPage() {
  const { data, error, loading, reload, setData } = useData<Dest[]>("/destinations");
  const canCreate = useCan("destinations.main", "create");
  const canEdit = useCan("destinations.main", "edit");
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const rows = data ?? [];

  async function reorder(from: number, to: number) {
    if (from === to || to < 0 || to >= rows.length) return;
    const next = move(rows, from, to);
    setData(next);
    try {
      await api.put("/destinations/order/all", { ids: next.map((d) => d.id) });
      toast("Order saved");
    } catch (e) {
      toast((e as Error).message, "bad");
      reload();
    }
  }

  return (
    <>
      <PageHead eyebrow="Catalogue" title="Destinations" sub="Drag cards, or use the arrows, to set the order of the 3D carousel on the Destinations page. The middle card opens first.">
        {canCreate && <Btn variant="gold" icon="plus" onClick={() => setOpen("new")}>Add destination</Btn>}
      </PageHead>
      <ErrorNote error={error} />
      {loading && !data ? <Loading /> : !rows.length ? <Panel><Empty icon="globe" title="No destinations yet" /></Panel> : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>
          {rows.map((d, i) => (
            <div
              key={d.id}
              className={cx("dest-card svc-dest svc-pic", !d.is_published && "svc-off", drag === i && "drag", over === i && drag !== i && "over")}
              style={picVars(d)}
              role="button"
              tabIndex={0}
              aria-label={`Edit ${d.name}`}
              draggable={canEdit}
              onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { if (drag !== null) { e.preventDefault(); setOver(i); } }}
              onDragLeave={() => setOver((o) => (o === i ? null : o))}
              onDrop={(e) => { e.preventDefault(); if (drag !== null) reorder(drag, i); setDrag(null); setOver(null); }}
              onDragEnd={() => { setDrag(null); setOver(null); }}
              onClick={() => setOpen(d.id)}
              onKeyDown={(e) => { if (e.key === "Enter") setOpen(d.id); }}
            >
              <span className="ord">{String(i + 1).padStart(2, "0")}</span>
              {canEdit && (
                <span className="grip" onClick={(e) => e.stopPropagation()}>
                  <button type="button" aria-label={`Move ${d.name} earlier`} disabled={i === 0} onClick={() => reorder(i, i - 1)}><Icon name="back" /></button>
                  <button type="button" aria-label={`Move ${d.name} later`} disabled={i === rows.length - 1} onClick={() => reorder(i, i + 1)}><Icon name="chev" /></button>
                  <Icon name="grip" />
                </span>
              )}
              <div className="ov">
                <div style={{ fontFamily: "var(--display)", fontSize: 22, fontWeight: 600 }}>{d.name}</div>
                <div style={{ fontSize: 11.5, opacity: 0.8 }}>{d.flag_emoji} {d.country_name} · {CAT[d.category]}{d.is_featured ? " · Featured" : ""}</div>
                <div className="row" style={{ marginTop: 8, justifyContent: "space-between", flexWrap: "nowrap" }}>
                  <span style={{ fontSize: 11, opacity: 0.85 }}>{d.hotels} hotels · {d.excursions} tours · {d.packages} pkg</span>
                  <LiveSwitch on={d.is_published} label={`${d.name} visible`} path={`/destinations/${d.id}`} field="is_published" disabled={!canEdit} onDone={(v) => setData((x) => x && x.map((r) => (r.id === d.id ? { ...r, is_published: v } : r)))} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Drawer open={!!open} onClose={() => setOpen(null)} label="Destination" head={<h2 style={{ fontSize: 24 }}>{open === "new" ? "New destination" : rows.find((r) => r.id === open)?.name}</h2>}>
        {open && <DestForm key={open} d={rows.find((r) => r.id === open) ?? null} onClose={() => setOpen(null)} onSaved={reload} />}
      </Drawer>
    </>
  );
}

function DestForm({ d, onClose, onSaved }: { d: Dest | null; onClose: () => void; onSaved: () => void }) {
  const countries = useData<{ iso2: string; name: string; flag_emoji: string | null }[]>("/destinations/countries");
  const { f, setF, set } = useForm({
    name: d?.name ?? "", slug: d?.slug ?? "", country_iso2: d?.country_iso2 ?? "PK", category: d?.category ?? "international", tagline: d?.tagline ?? "",
    description: d?.description ?? "", best_time: d?.best_time ?? "", flight_note: d?.flight_note ?? "", lat: numStr(d?.lat), lng: numStr(d?.lng),
    price_from: numStr(d?.price_from), currency_code: d?.currency_code ?? "PKR", image_day_url: d?.image_day_url ?? null, image_night_url: d?.image_night_url ?? null,
    is_featured: d?.is_featured ?? false, is_published: d?.is_published ?? true,
  });
  const canSave = useCan("destinations.main", d ? "edit" : "create");
  const canDelete = useCan("destinations.main", "delete");
  const { busy, run } = useAction();
  const del = useDelete();
  async function save() {
    const body = { ...f, lat: toNum(f.lat), lng: toNum(f.lng), price_from: toNum(f.price_from) };
    const out = await run(() => (d ? api.put(`/destinations/${d.id}`, body) : api.post("/destinations", body)), d ? "Destination saved" : "Destination added");
    if (out) { onSaved(); onClose(); }
  }
  return (
    <>
      <div className="grid g-2">
        <Field label="Day photo" hint="Shown in the light theme"><ImageUpload value={f.image_day_url} onChange={set("image_day_url")} folder="destinations" aspect="3/4" /></Field>
        <Field label="Evening photo" hint="Shown in the dark theme"><ImageUpload value={f.image_night_url} onChange={set("image_night_url")} folder="destinations" aspect="3/4" /></Field>
      </div>
      <div className="f-grid">
        <Field label="Name"><Input value={f.name} onChange={(e) => { const v = e.target.value; setF((x) => ({ ...x, name: v, slug: d ? x.slug : slugify(v) })); }} /></Field>
        <Field label="Web address" hint={`skyholidays.pk/destinations/${f.slug || "…"}`}><Input value={f.slug} onChange={(e) => set("slug")(slugify(e.target.value))} /></Field>
        <Field label="Country"><Select value={f.country_iso2} onChange={(e) => set("country_iso2")(e.target.value)} options={(countries.data ?? [{ iso2: f.country_iso2, name: f.country_iso2, flag_emoji: null }]).map((c) => ({ value: c.iso2, label: `${c.flag_emoji ?? ""} ${c.name}`.trim() }))} /></Field>
        <Field label="Category"><Select value={f.category} onChange={(e) => set("category")(e.target.value as Dest["category"])} options={Object.entries(CAT).map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="Tagline" className="span-all" hint="e.g. Visa in 3 days"><Input value={f.tagline} onChange={(e) => set("tagline")(e.target.value)} /></Field>
        <Field label="Description" className="span-all"><Textarea rows={4} value={f.description} onChange={(e) => set("description")(e.target.value)} /></Field>
        <Field label="Best time to go" hint="e.g. Nov to Mar"><Input value={f.best_time} onChange={(e) => set("best_time")(e.target.value)} /></Field>
        <Field label="Flight note" hint="e.g. 2 h 30 min from Karachi"><Input value={f.flight_note} onChange={(e) => set("flight_note")(e.target.value)} /></Field>
        <Field label="Latitude"><NumInput value={f.lat} onChange={set("lat")} min={-90} /></Field>
        <Field label="Longitude"><NumInput value={f.lng} onChange={set("lng")} min={-180} /></Field>
        <Field label="Price from"><NumInput value={f.price_from} onChange={set("price_from")} pre={f.currency_code} /></Field>
        <Field label="Currency"><Select value={f.currency_code} onChange={(e) => set("currency_code")(e.target.value)} options={["PKR", "USD", "SAR", "AED"]} /></Field>
      </div>
      <div>
        <SwitchRow title="Featured" sub="Shown first on the homepage" checked={f.is_featured} onChange={set("is_featured")} />
        <SwitchRow title="Visible on the website" checked={f.is_published} onChange={set("is_published")} />
      </div>
      {d && <p className="muted" style={{ margin: 0 }}>{d.hotels} hotels, {d.excursions} excursions and {d.packages} packages are linked to this destination.</p>}
      <div className="row svc-foot">
        {canSave && <Btn variant="gold" icon="check" busy={busy} onClick={save}>{d ? "Save destination" : "Add destination"}</Btn>}
        {d && f.is_published && <a className="btn" href={siteUrl(`/destinations/${d.slug}`)} target="_blank" rel="noreferrer"><Icon name="eye" />View on site</a>}
        <span style={{ flex: 1 }} />
        {d && canDelete && <Btn variant="danger" icon="trash" onClick={async () => { if (await del(`/destinations/${d.id}`, d.name, "Linked hotels and excursions stay but lose their destination; package links are removed.")) { onSaved(); onClose(); } }}>Delete</Btn>}
      </div>
    </>
  );
}
