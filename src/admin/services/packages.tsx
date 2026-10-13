"use client";
// Packages list (per sub-tab) and the package drawer editor.
import { useMemo, useState } from "react";
import { api, useData } from "../api";
import { date, money, siteUrl, slugify } from "../format";
import { useCan } from "../shell";
import {
  Btn, Drawer, Empty, ErrorNote, Field, IconBtn, ImageUpload, Input, Loading, PageHead, Panel, Pill, Search, Select, SwitchRow, Tags, Textarea, type Tone,
} from "../ui";
import { LiveSwitch, NumInput, numStr, picVars, rowProps, SubHead, toNum, useAction, useDelete, useForm } from "./common";

type Row = {
  id: string; slug: string; title: string; category: string; duration_days: number; nights: number; price_from: number; price_was: number | null;
  price_unit: string; currency_code: string; is_deal: boolean; deal_badge: string | null; is_featured: boolean; status: string;
  image_day_url: string | null; image_night_url: string | null; departures: number; next_departure: string | null;
};
type Counts = { all: number; international: number; domestic: number; deals: number };
type Itin = { day: string; title: string; text: string };
type Opt = { label: string; adult: string; child: string; infant: string };
type Dep = { id?: string; depart_date: string; return_date: string; seats_total: string; seats_sold: string; price_override: string; status: string };
type Full = Row & {
  itinerary_label: string | null; includes_label: string | null; summary: string | null; inclusions: string[]; exclusions: string[];
  itinerary: Itin[]; price_options: { label: string; adult: number | null; child: number | null; infant: number | null }[];
  destinations: { destination_id: string; nights: number | null; name: string }[];
  departures: never; // replaced below
};
type FullPkg = Omit<Full, "departures"> & { departures: { id: string; depart_date: string; return_date: string | null; seats_total: number; seats_sold: number; price_override: number | null; status: string }[] };

export const CAT: Record<string, [string, Tone]> = {
  international: ["International", "sig"], domestic: ["Domestic", "info"], umrah: ["Umrah", "gold"], honeymoon: ["Honeymoon", "sig"],
};
const STATUS: Record<string, [string, Tone]> = { published: ["Published", "good"], draft: ["Draft", "warn"], archived: ["Archived", "plain"] };
const SUB: Record<string, string> = {
  all: "Bundles of flights, hotels, transfers and tours. Mark a package as a deal to show it in Weekly deals.",
  international: "Packages abroad, including honeymoon packages.",
  domestic: "Tours inside Pakistan: the north, Skardu, Hunza and more.",
  deals: "Packages shown in Weekly deals on the website. Switch a deal off to take it out.",
};

export function PackagesTab({ tab, label }: { tab: string; label: string }) {
  const { data, error, loading, reload, setData } = useData<{ rows: Row[]; counts: Counts }>(`/packages?tab=${tab}`);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null); // id or "new"
  const canCreate = useCan("packages", "create");
  const canEdit = useCan("packages", "edit");
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => !q || r.title.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const patchRow = (id: string, p: Partial<Row>) => setData((d) => d && { ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, ...p } : r)) });

  return (
    <>
      <PageHead eyebrow="Packages" title={label} sub={SUB[tab]}>
        <Search value={q} onChange={setQ} placeholder="Search packages" />
        {canCreate && <Btn variant="gold" icon="plus" onClick={() => setOpen("new")}>Add package</Btn>}
      </PageHead>
      <ErrorNote error={error} />
      {loading && !data ? <Loading /> : (
        <Panel>
          {!rows.length ? <Empty icon="bag" title={q ? "Nothing matches your search" : "No packages here yet"}>{tab === "deals" && "Switch on Weekly deal for a package to list it here."}</Empty> : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Package</th><th>Type</th><th>Nights</th><th className="num">From</th><th>Departures</th><th>Weekly deal</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} {...rowProps(() => setOpen(p.id))}>
                      <td>
                        <div className="row" style={{ flexWrap: "nowrap" }}>
                          <div className="thumb lg svc-pic" style={picVars(p)} />
                          <div style={{ minWidth: 0 }}><b>{p.title}</b><div className="t2">{p.duration_days} days{p.deal_badge ? ` · ${p.deal_badge}` : ""}{p.is_featured ? " · Featured" : ""}</div></div>
                        </div>
                      </td>
                      <td><Pill tone={CAT[p.category]?.[1]}>{CAT[p.category]?.[0] ?? p.category}</Pill></td>
                      <td className="tab">{p.nights}</td>
                      <td className="num tab"><b>{money(p.price_from, p.currency_code)}</b>{p.price_was ? <div className="t2" style={{ textDecoration: "line-through" }}>{money(p.price_was, p.currency_code)}</div> : null}</td>
                      <td>{p.departures ? <>{p.departures} fixed {p.departures === 1 ? "date" : "dates"}<div className="t2">Next {date(p.next_departure, false)}</div></> : "Any date"}</td>
                      <td><LiveSwitch on={p.is_deal} label={`${p.title} weekly deal`} path={`/packages/${p.id}`} field="is_deal" disabled={!canEdit} onDone={(v) => patchRow(p.id, { is_deal: v })} /></td>
                      <td><Pill tone={STATUS[p.status]?.[1]}>{STATUS[p.status]?.[0] ?? p.status}</Pill></td>
                      <td><IconBtn icon="edit" label={`Edit ${p.title}`} onClick={(e) => { e.stopPropagation(); setOpen(p.id); }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      <PackageDrawer id={open} tab={tab} onClose={() => setOpen(null)} onSaved={reload} />
    </>
  );
}

/* ---------------- drawer ---------------- */

type Form = {
  title: string; slug: string; category: string; status: string; duration_days: string; nights: string; itinerary_label: string; includes_label: string;
  summary: string; inclusions: string[]; exclusions: string[]; image_day_url: string | null; image_night_url: string | null;
  price_from: string; price_was: string; price_unit: string; currency_code: string; is_deal: boolean; deal_badge: string; is_featured: boolean;
  itinerary: Itin[]; price_options: Opt[]; destinations: { destination_id: string; nights: string }[]; departures: Dep[];
};
const EMPTY: Form = {
  title: "", slug: "", category: "international", status: "draft", duration_days: "5", nights: "4", itinerary_label: "", includes_label: "", summary: "",
  inclusions: [], exclusions: [], image_day_url: null, image_night_url: null, price_from: "", price_was: "", price_unit: "per person", currency_code: "PKR",
  is_deal: false, deal_badge: "", is_featured: false, itinerary: [], price_options: [], destinations: [], departures: [],
};
const toForm = (p: FullPkg): Form => ({
  title: p.title, slug: p.slug, category: p.category, status: p.status, duration_days: String(p.duration_days), nights: String(p.nights),
  itinerary_label: p.itinerary_label ?? "", includes_label: p.includes_label ?? "", summary: p.summary ?? "", inclusions: p.inclusions, exclusions: p.exclusions,
  image_day_url: p.image_day_url, image_night_url: p.image_night_url, price_from: numStr(p.price_from), price_was: numStr(p.price_was), price_unit: p.price_unit,
  currency_code: p.currency_code, is_deal: p.is_deal, deal_badge: p.deal_badge ?? "", is_featured: p.is_featured,
  itinerary: p.itinerary ?? [], price_options: (p.price_options ?? []).map((o) => ({ label: o.label, adult: numStr(o.adult), child: numStr(o.child), infant: numStr(o.infant) })),
  destinations: p.destinations.map((d) => ({ destination_id: d.destination_id, nights: numStr(d.nights) })),
  departures: p.departures.map((d) => ({ id: d.id, depart_date: d.depart_date, return_date: d.return_date ?? "", seats_total: String(d.seats_total), seats_sold: String(d.seats_sold), price_override: numStr(d.price_override), status: d.status })),
});

function PackageDrawer({ id, tab, onClose, onSaved }: { id: string | null; tab: string; onClose: () => void; onSaved: () => void }) {
  const isNew = id === "new";
  const { data, error, loading } = useData<FullPkg>(id && !isNew ? `/packages/${id}` : null);
  const key = isNew ? "new" : data?.id === id ? id : null;
  return (
    <Drawer open={!!id} onClose={onClose} label="Package" head={<h2 style={{ fontSize: 24 }}>{isNew ? "New package" : data?.title ?? "Package"}</h2>}>
      <ErrorNote error={error} />
      {id && !key && loading && <Loading />}
      {key && <PackageForm key={key} initial={isNew ? { ...EMPTY, category: tab === "domestic" ? "domestic" : "international", is_deal: tab === "deals" } : toForm(data!)} id={isNew ? null : id} onClose={onClose} onSaved={onSaved} />}
    </Drawer>
  );
}

function PackageForm({ initial, id, onClose, onSaved }: { initial: Form; id: string | null; onClose: () => void; onSaved: () => void }) {
  const { f, setF, set } = useForm<Form>(initial);
  const dests = useData<{ id: string; name: string; category: string }[]>("/packages/destinations");
  const canEdit = useCan("packages", id ? "edit" : "create");
  const canDelete = useCan("packages", "delete");
  const { busy, run } = useAction();
  const del = useDelete();
  const [slugTouched, setSlugTouched] = useState(!!id);
  const um = f.category === "umrah";

  const upd = <K extends "itinerary" | "price_options" | "destinations" | "departures">(k: K, i: number, p: Partial<Form[K][number]>) =>
    setF((x) => ({ ...x, [k]: (x[k] as Form[K][number][]).map((r, j) => (j === i ? { ...r, ...p } : r)) }));
  const drop = (k: "itinerary" | "price_options" | "destinations" | "departures", i: number) => setF((x) => ({ ...x, [k]: (x[k] as unknown[]).filter((_, j) => j !== i) }));

  async function save() {
    const body = {
      ...f,
      duration_days: toNum(f.duration_days), nights: toNum(f.nights), price_from: toNum(f.price_from), price_was: toNum(f.price_was),
      itinerary_label: f.itinerary_label || null, includes_label: f.includes_label || null, deal_badge: f.deal_badge || null,
      itinerary: f.itinerary.filter((d) => d.day || d.title),
      price_options: f.price_options.filter((o) => o.label).map((o) => ({ label: o.label, adult: toNum(o.adult), child: toNum(o.child), infant: toNum(o.infant) })),
      destinations: f.destinations.filter((d) => d.destination_id).map((d) => ({ destination_id: d.destination_id, nights: toNum(d.nights) })),
      departures: f.departures.filter((d) => d.depart_date).map((d) => ({ ...d, return_date: d.return_date || null, seats_total: toNum(d.seats_total) ?? 0, seats_sold: toNum(d.seats_sold) ?? 0, price_override: toNum(d.price_override) })),
    };
    const out = await run(() => (id ? api.put(`/packages/${id}`, body) : api.post("/packages", body)), id ? "Package saved" : "Package added");
    if (out) { onSaved(); onClose(); }
  }

  return (
    <>
      <div className="grid g-2">
        <Field label="Day photo" hint="Shown in the light theme"><ImageUpload value={f.image_day_url} onChange={set("image_day_url")} folder="packages" aspect="16/9" /></Field>
        <Field label="Evening photo" hint="Shown in the dark theme"><ImageUpload value={f.image_night_url} onChange={set("image_night_url")} folder="packages" aspect="16/9" /></Field>
      </div>

      <div className="f-grid">
        <Field label="Name" className="span-all"><Input value={f.title} onChange={(e) => { const v = e.target.value; setF((x) => ({ ...x, title: v, slug: slugTouched ? x.slug : slugify(v) })); }} /></Field>
        <Field label="Web address" hint={`skyholidays.pk/packages/${f.slug || "…"}`}><Input value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug")(slugify(e.target.value)); }} /></Field>
        <Field label="Type"><Select value={f.category} onChange={(e) => set("category")(e.target.value)} options={Object.entries(CAT).map(([value, [label]]) => ({ value, label }))} /></Field>
        <Field label="Days"><NumInput value={f.duration_days} onChange={set("duration_days")} min={1} /></Field>
        <Field label="Nights"><NumInput value={f.nights} onChange={set("nights")} /></Field>
        <Field label="Route" hint={um ? "e.g. Makkah 8N · Madinah 7N" : "e.g. 7 Days · Hunza & Skardu"}><Input value={f.itinerary_label} onChange={(e) => set("itinerary_label")(e.target.value)} /></Field>
        <Field label="Includes, in short" hint="e.g. Visa + flights + hotels"><Input value={f.includes_label} onChange={(e) => set("includes_label")(e.target.value)} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status")(e.target.value)} options={Object.entries(STATUS).map(([value, [label]]) => ({ value, label }))} /></Field>
        <Field label="Summary" className="span-all"><Textarea rows={3} value={f.summary} onChange={(e) => set("summary")(e.target.value)} /></Field>
        <Field label="Includes" className="span-all"><Tags value={f.inclusions} onChange={set("inclusions")} placeholder="e.g. Return flights" /></Field>
        <Field label="Not included" className="span-all"><Tags value={f.exclusions} onChange={set("exclusions")} placeholder="e.g. Lunches" /></Field>
      </div>

      <Panel className="svc-inner">
        <SubHead actions={<Btn size="sm" icon="plus" onClick={() => set("destinations")([...f.destinations, { destination_id: "", nights: "" }])}>Add place</Btn>}>Places and nights</SubHead>
        {!f.destinations.length && <p className="muted" style={{ margin: 0 }}>Link destinations so the package shows on their pages.</p>}
        {f.destinations.map((d, i) => (
          <div className="row svc-line" key={i}>
            <Select aria-label="Destination" style={{ flex: 2, minWidth: 140 }} value={d.destination_id} placeholder="Choose a destination" onChange={(e) => upd("destinations", i, { destination_id: e.target.value })} options={(dests.data ?? []).map((x) => ({ value: x.id, label: x.name }))} />
            <NumInput aria-label="Nights" value={d.nights} onChange={(v) => upd("destinations", i, { nights: v })} pre="Nights" />
            <IconBtn icon="trash" label="Remove" onClick={() => drop("destinations", i)} />
          </div>
        ))}
      </Panel>

      <Panel className="svc-inner">
        <SubHead>Price</SubHead>
        <div className="f-grid">
          <Field label={f.is_deal ? "Deal price, from" : "Price from"}><NumInput value={f.price_from} onChange={set("price_from")} pre={f.currency_code} /></Field>
          <Field label="Was price" hint="Shown crossed out"><NumInput value={f.price_was} onChange={set("price_was")} pre={f.currency_code} /></Field>
          <Field label="Price is"><Select value={f.price_unit} onChange={(e) => set("price_unit")(e.target.value)} options={["per person", "per couple", "per family", "per group"]} /></Field>
          <Field label="Currency"><Select value={f.currency_code} onChange={(e) => set("currency_code")(e.target.value)} options={["PKR", "USD", "SAR", "AED"]} /></Field>
        </div>
        <SubHead actions={<Btn size="sm" icon="plus" onClick={() => set("price_options")([...f.price_options, { label: "", adult: "", child: "", infant: "" }])}>Add row</Btn>}>
          {um ? "Price per person by room sharing" : "Price per person by room"}
        </SubHead>
        {f.price_options.length ? (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>{um ? "Sharing" : "Room"}</th><th className="num">Adult</th><th className="num">Child with bed</th><th className="num">Infant</th><th /></tr></thead>
              <tbody>
                {f.price_options.map((o, i) => (
                  <tr key={i}>
                    <td><Input aria-label="Room" value={o.label} placeholder={um ? "Quad" : "Twin share"} onChange={(e) => upd("price_options", i, { label: e.target.value })} /></td>
                    <td><NumInput aria-label="Adult" value={o.adult} onChange={(v) => upd("price_options", i, { adult: v })} /></td>
                    <td><NumInput aria-label="Child" value={o.child} onChange={(v) => upd("price_options", i, { child: v })} /></td>
                    <td><NumInput aria-label="Infant" value={o.infant} onChange={(v) => upd("price_options", i, { infant: v })} /></td>
                    <td><IconBtn icon="trash" label="Remove" onClick={() => drop("price_options", i)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted" style={{ margin: 0 }}>Optional. Add rows such as {um ? "Quad, Triple and Double" : "Twin share and Single"}.</p>}
      </Panel>

      <Panel className="svc-inner">
        <SubHead actions={<Btn size="sm" icon="plus" onClick={() => set("itinerary")([...f.itinerary, { day: `Day ${f.itinerary.length + 1}`, title: "", text: "" }])}>Add day</Btn>}>Day by day</SubHead>
        {!f.itinerary.length && <p className="muted" style={{ margin: 0 }}>No days yet.</p>}
        <ul className="timeline">
          {f.itinerary.map((d, i) => (
            <li key={i}>
              <span className="dt" />
              <div className="svc-day">
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <Input aria-label="Day" className="svc-dayn" value={d.day} onChange={(e) => upd("itinerary", i, { day: e.target.value })} />
                  <Input aria-label="Title" style={{ flex: 1, minWidth: 0 }} placeholder="What happens" value={d.title} onChange={(e) => upd("itinerary", i, { title: e.target.value })} />
                </div>
                <Textarea aria-label="Details" rows={2} placeholder="Details (optional)" value={d.text} onChange={(e) => upd("itinerary", i, { text: e.target.value })} />
              </div>
              <span className="row svc-ord" style={{ gap: 2, flexWrap: "nowrap", alignSelf: "start" }}>
                <IconBtn icon="back" label="Move up" disabled={i === 0} onClick={() => setF((x) => ({ ...x, itinerary: swap(x.itinerary, i, i - 1) }))} />
                <IconBtn icon="trash" label="Remove day" onClick={() => drop("itinerary", i)} />
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="svc-inner">
        <SubHead actions={<Btn size="sm" icon="plus" onClick={() => set("departures")([...f.departures, { depart_date: "", return_date: "", seats_total: "20", seats_sold: "0", price_override: "", status: "open" }])}>Add date</Btn>}>Fixed departures</SubHead>
        <p className="muted" style={{ margin: 0 }}>
          Leave empty when guests can travel on any date.{um && " Flights, group leader and visa progress for Umrah groups are under Umrah → Group departures."}
        </p>
        {!!f.departures.length && (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Departs</th><th>Returns</th><th className="num">Seats</th><th className="num">Sold</th><th className="num">Price</th><th>Status</th><th /></tr></thead>
              <tbody>
                {f.departures.map((d, i) => (
                  <tr key={d.id ?? `n${i}`}>
                    <td><Input type="date" aria-label="Departs" value={d.depart_date} onChange={(e) => upd("departures", i, { depart_date: e.target.value })} /></td>
                    <td><Input type="date" aria-label="Returns" value={d.return_date} onChange={(e) => upd("departures", i, { return_date: e.target.value })} /></td>
                    <td><NumInput aria-label="Seats" value={d.seats_total} onChange={(v) => upd("departures", i, { seats_total: v })} /></td>
                    <td><NumInput aria-label="Sold" value={d.seats_sold} onChange={(v) => upd("departures", i, { seats_sold: v })} /></td>
                    <td><NumInput aria-label="Price for this date" placeholder="Package price" value={d.price_override} onChange={(v) => upd("departures", i, { price_override: v })} /></td>
                    <td><Select aria-label="Status" value={d.status} onChange={(e) => upd("departures", i, { status: e.target.value })} options={[{ value: "open", label: "Open" }, { value: "full", label: "Full" }, { value: "closed", label: "Closed" }, { value: "departed", label: "Departed" }, { value: "cancelled", label: "Cancelled" }]} /></td>
                    <td><IconBtn icon="trash" label="Remove date" onClick={() => drop("departures", i)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div>
        <SwitchRow title="Show in Weekly deals" sub="Lists the package on the Weekly deals strip" checked={f.is_deal} onChange={set("is_deal")} />
        {f.is_deal && <div className="f-grid" style={{ marginBottom: 8 }}><Field label="Deal badge" hint="e.g. Hot deal, Best seller"><Input value={f.deal_badge} onChange={(e) => set("deal_badge")(e.target.value)} /></Field></div>}
        <SwitchRow title="Featured" sub="Shown first in lists" checked={f.is_featured} onChange={set("is_featured")} />
      </div>

      <div className="row svc-foot">
        {canEdit && <Btn variant="gold" icon="check" busy={busy} onClick={save}>{id ? "Save package" : "Add package"}</Btn>}
        {id && f.status === "published" && <a className="btn" href={siteUrl(`/packages/${initial.slug}`)} target="_blank" rel="noreferrer"><svg className="i" aria-hidden="true"><use href="#i-eye" /></svg>View on site</a>}
        <span className="spacer" style={{ flex: 1 }} />
        {id && canDelete && <Btn variant="danger" icon="trash" onClick={async () => { if (await del(`/packages/${id}`, "this package", "Its departures go too. Bookings already made keep their details.")) { onSaved(); onClose(); } }}>Delete</Btn>}
      </div>
    </>
  );
}

function swap<T>(a: T[], i: number, j: number) {
  if (j < 0 || j >= a.length) return a;
  const o = [...a];
  [o[i], o[j]] = [o[j], o[i]];
  return o;
}

