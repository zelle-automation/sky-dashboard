"use client";
// Car rental: fleet, rates & rules, chauffeurs.
import { useMemo, useState } from "react";
import { api, useData } from "../api";
import { date, fmt } from "../format";
import { useCan, useMe } from "../shell";
import {
  Btn, Drawer, Empty, ErrorNote, Field, Icon, ImageUpload, Input, Loading, PageHead, Panel, Pill, Search, Select, SwitchRow, Tags, Textarea, type Tone,
} from "../ui";
import { isoInDays, LiveSwitch, NumInput, numStr, rowProps, toNum, useAction, useDelete, useForm } from "./common";

type Car = {
  id: string; name: string; category: string; seats: number; transmission: "automatic" | "manual"; with_driver_daily: number | null; self_drive_daily: number | null;
  cities: string[]; units: number; photo_url: string | null; currency_code: string; is_live: boolean; sort_order: number;
};
type Rules = {
  km_per_day: number; extra_km_rate: number; fuel_policy: string; outstation_pct: number; driver_allowance_night: number; driver_hours: number;
  security_deposit: number; min_age: number; documents: string[]; self_drive_outstation: boolean; northern_4x4_driver: boolean; tolls_by_customer: boolean;
};
type Driver = {
  id: string; name: string; phone: string | null; cnic: string | null; licence_no: string | null; licence_type: string | null; licence_expiry: string | null;
  languages: string[]; cities: string[]; drives: string | null; rating: number | null; photo_url: string | null; status: string; notes: string | null;
};
const CATS = ["Hatchback", "Sedan", "SUV", "4x4", "Van", "Bus"];
const DSTATUS: Record<string, [string, Tone]> = { available: ["Available", "good"], on_trip: ["On trip", "sig"], off: ["Off today", "plain"], inactive: ["Not working with us", "bad"] };

function Head({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return <PageHead eyebrow="Car rental" title={title} sub={sub}>{children}</PageHead>;
}

/* ================= fleet ================= */

export function FleetTab({ label }: { label: string }) {
  const { data, error, loading, reload, setData } = useData<Car[]>("/cars/fleet");
  const canCreate = useCan("cars.fleet", "create");
  const canEdit = useCan("cars.fleet", "edit");
  const [open, setOpen] = useState<string | null>(null);
  const rows = data ?? [];
  return (
    <>
      <Head title={label} sub="Cars for rent with a chauffeur or as self-drive. Prices are per day.">
        {canCreate && <Btn variant="gold" icon="plus" onClick={() => setOpen("new")}>Add car</Btn>}
      </Head>
      <ErrorNote error={error} />
      {loading && !data ? <Loading /> : (
        <Panel>
          {!rows.length ? <Empty icon="car" title="No cars yet" /> : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Car</th><th>Type</th><th>Seats</th><th>Gearbox</th><th className="num">With driver</th><th className="num">Self-drive</th><th>Cities</th><th>Units</th><th>Live</th></tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} {...rowProps(() => setOpen(c.id))}>
                      <td>
                        <div className="row" style={{ flexWrap: "nowrap" }}>
                          {c.photo_url ? <span className="svc-vimg" style={{ width: 38, height: 38, borderRadius: 10, backgroundImage: `url("${c.photo_url}")` }} />
                            : <span className="pm-ic" style={{ width: 38, height: 38, borderRadius: 10 }}><Icon name={/van|bus/i.test(c.category) ? "van" : "car"} /></span>}
                          <b>{c.name}</b>
                        </div>
                      </td>
                      <td>{c.category}</td>
                      <td className="tab">{c.seats}</td>
                      <td>{c.transmission === "automatic" ? "Automatic" : "Manual"}</td>
                      <td className="num tab"><b>{c.with_driver_daily ? fmt(c.with_driver_daily) : "Not offered"}</b></td>
                      <td className="num tab">{c.self_drive_daily ? fmt(c.self_drive_daily) : "Not offered"}</td>
                      <td>{c.cities.join(", ") || "–"}</td>
                      <td className="tab">{c.units}</td>
                      <td><LiveSwitch on={c.is_live} label={c.name} path={`/cars/fleet/${c.id}`} field="is_live" disabled={!canEdit} onDone={(v) => setData((d) => d && d.map((x) => (x.id === c.id ? { ...x, is_live: v } : x)))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      <Drawer open={!!open} onClose={() => setOpen(null)} label="Car" head={<h2 style={{ fontSize: 24 }}>{open === "new" ? "New car" : rows.find((r) => r.id === open)?.name}</h2>}>
        {open && <CarForm key={open} c={rows.find((r) => r.id === open) ?? null} onClose={() => setOpen(null)} onSaved={reload} />}
      </Drawer>
    </>
  );
}

function CarForm({ c, onClose, onSaved }: { c: Car | null; onClose: () => void; onSaved: () => void }) {
  const { f, set } = useForm({
    name: c?.name ?? "", category: c?.category ?? "Sedan", seats: String(c?.seats ?? 4), transmission: c?.transmission ?? "automatic",
    with_driver_daily: numStr(c?.with_driver_daily), self_drive_daily: numStr(c?.self_drive_daily), cities: c?.cities ?? [], units: String(c?.units ?? 1),
    photo_url: c?.photo_url ?? null, is_live: c?.is_live ?? true, sort_order: String(c?.sort_order ?? 0),
  });
  const canSave = useCan("cars.fleet", c ? "edit" : "create");
  const canDelete = useCan("cars.fleet", "delete");
  const { busy, run } = useAction();
  const del = useDelete();
  async function save() {
    const body = { ...f, seats: toNum(f.seats), units: toNum(f.units), with_driver_daily: toNum(f.with_driver_daily), self_drive_daily: toNum(f.self_drive_daily), sort_order: toNum(f.sort_order) ?? 0 };
    const out = await run(() => (c ? api.put(`/cars/fleet/${c.id}`, body) : api.post("/cars/fleet", body)), c ? "Car saved" : "Car added");
    if (out) { onSaved(); onClose(); }
  }
  return (
    <>
      <div className="f-grid">
        <Field label="Car" className="span-all" hint="e.g. Toyota Corolla GLi"><Input value={f.name} onChange={(e) => set("name")(e.target.value)} /></Field>
        <Field label="Type"><Select value={f.category} onChange={(e) => set("category")(e.target.value)} options={[...new Set([...CATS, f.category])]} /></Field>
        <Field label="Seats"><NumInput value={f.seats} onChange={set("seats")} min={1} /></Field>
        <Field label="Gearbox"><Select value={f.transmission} onChange={(e) => set("transmission")(e.target.value as "automatic" | "manual")} options={[{ value: "automatic", label: "Automatic" }, { value: "manual", label: "Manual" }]} /></Field>
        <Field label="Units in fleet"><NumInput value={f.units} onChange={set("units")} /></Field>
        <Field label="With driver, per day"><NumInput value={f.with_driver_daily} onChange={set("with_driver_daily")} pre="PKR" /></Field>
        <Field label="Self-drive, per day" hint="Leave empty if not offered"><NumInput value={f.self_drive_daily} onChange={set("self_drive_daily")} pre="PKR" /></Field>
        <Field label="Cities" className="span-all"><Tags value={f.cities} onChange={set("cities")} placeholder="e.g. Lahore" /></Field>
        <Field label="Order"><NumInput value={f.sort_order} onChange={set("sort_order")} /></Field>
      </div>
      <Field label="Photo"><ImageUpload value={f.photo_url} onChange={set("photo_url")} folder="general" aspect="16/9" /></Field>
      <SwitchRow title="Live on the website" checked={f.is_live} onChange={set("is_live")} />
      <div className="row svc-foot">
        {canSave && <Btn variant="gold" icon="check" busy={busy} onClick={save}>{c ? "Save car" : "Add car"}</Btn>}
        <span style={{ flex: 1 }} />
        {c && canDelete && <Btn variant="danger" icon="trash" onClick={async () => { if (await del(`/cars/fleet/${c.id}`, "this car")) { onSaved(); onClose(); } }}>Delete</Btn>}
      </div>
    </>
  );
}

/* ================= rates & rules ================= */

export function RatesTab({ label }: { label: string }) {
  const { data, error, loading, setData } = useData<Rules>("/cars/rules");
  const canEdit = useCan("cars.rates", "edit");
  const { busy, run } = useAction();
  const [draft, setDraft] = useState<Rules | null>(null);
  const v = draft ?? data;
  const set = <K extends keyof Rules>(k: K) => (val: Rules[K]) => setDraft((d) => ({ ...(d ?? data!), [k]: val }));
  const n = <K extends keyof Rules>(k: K) => (s: string) => set(k)((Number(s) || 0) as Rules[K]);
  async function save() {
    const out = await run(() => api.put<Rules>("/cars/rules", draft ?? data), "Rules saved");
    if (out) { setData(out); setDraft(null); }
  }
  return (
    <>
      <Head title={label} sub="Rules that apply to every rental. Daily prices are set per car under Fleet.">
        {canEdit && <Btn variant="gold" icon="check" busy={busy} disabled={!draft} onClick={save}>Save</Btn>}
      </Head>
      <ErrorNote error={error} />
      {loading && !v ? <Loading /> : v && (
        <div className="grid g-2" style={{ alignItems: "start" }}>
          <Panel title="Mileage & fuel">
            <div className="f-grid">
              <Field label="Included per day"><NumInput value={String(v.km_per_day)} onChange={n("km_per_day")} pre="km" /></Field>
              <Field label="Extra kilometre"><NumInput value={String(v.extra_km_rate)} onChange={n("extra_km_rate")} pre="PKR" /></Field>
              <Field label="Fuel"><Select value={v.fuel_policy} onChange={(e) => set("fuel_policy")(e.target.value)} options={[{ value: "customer", label: "Paid by customer" }, { value: "included", label: "Included" }, { value: "full_to_full", label: "Full to full" }]} /></Field>
              <Field label="Outstation surcharge"><NumInput value={String(v.outstation_pct)} onChange={n("outstation_pct")} pre="%" /></Field>
              <Field label="Driver overnight allowance"><NumInput value={String(v.driver_allowance_night)} onChange={n("driver_allowance_night")} pre="PKR" /></Field>
              <Field label="Driver hours per day"><NumInput value={String(v.driver_hours)} onChange={n("driver_hours")} pre="hrs" /></Field>
            </div>
          </Panel>
          <Panel title="Self-drive">
            <div className="f-grid">
              <Field label="Security deposit"><NumInput value={String(v.security_deposit)} onChange={n("security_deposit")} pre="PKR" /></Field>
              <Field label="Minimum driver age"><Select value={String(v.min_age)} onChange={(e) => set("min_age")(Number(e.target.value))} options={[...new Set([18, 21, 23, 25, v.min_age])].sort().map((a) => ({ value: String(a), label: String(a) }))} /></Field>
              <Field label="Documents required" className="span-all"><Tags value={v.documents} onChange={set("documents")} placeholder="e.g. CNIC" /></Field>
            </div>
            <div style={{ marginTop: 8 }}>
              <SwitchRow title="Self-drive allowed outside the city" checked={v.self_drive_outstation} onChange={set("self_drive_outstation")} disabled={!canEdit} />
              <SwitchRow title="Northern areas need a 4x4 with driver" checked={v.northern_4x4_driver} onChange={set("northern_4x4_driver")} disabled={!canEdit} />
              <SwitchRow title="Tolls and parking paid by customer" checked={v.tolls_by_customer} onChange={set("tolls_by_customer")} disabled={!canEdit} />
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}

/* ================= chauffeurs ================= */

export function DriversTab({ label }: { label: string }) {
  const { data, error, loading, reload } = useData<{ rows: Driver[]; masked: boolean }>("/cars/drivers");
  const canCreate = useCan("cars.drivers", "create");
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const rows = useMemo(() => (data?.rows ?? []).filter((d) => !q || `${d.name} ${d.cities.join(" ")} ${d.drives ?? ""}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const today = isoInDays(0);
  const soon = isoInDays(60);
  return (
    <>
      <Head title={label} sub="Drivers for chauffeur rentals and transfers.">
        <Search value={q} onChange={setQ} placeholder="Search chauffeurs" />
        {canCreate && <Btn variant="gold" icon="plus" onClick={() => setOpen("new")}>Add chauffeur</Btn>}
      </Head>
      <ErrorNote error={error} />
      {loading && !data ? <Loading /> : (
        <Panel>
          {!rows.length ? <Empty icon="users" title={q ? "Nothing matches your search" : "No chauffeurs yet"} /> : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Name</th><th>CNIC</th><th>Languages</th><th>Licence</th><th>Drives</th><th>Cities</th><th>Rating</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.id} {...rowProps(() => setOpen(d.id))}>
                      <td><b>{d.name}</b><div className="t2">{d.phone ?? ""}</div></td>
                      <td className="mono">{d.cnic ?? "–"}</td>
                      <td>{d.languages.join(", ") || "–"}</td>
                      <td>{d.licence_type ?? "–"}<div className="t2">{d.licence_expiry ? (d.licence_expiry < today ? <span style={{ color: "var(--bad)" }}>Expired {date(d.licence_expiry)}</span> : d.licence_expiry < soon ? <span style={{ color: "var(--warn)" }}>Expires {date(d.licence_expiry)}</span> : `Valid to ${date(d.licence_expiry)}`) : ""}</div></td>
                      <td>{d.drives ?? "–"}</td>
                      <td>{d.cities.join(", ") || "–"}</td>
                      <td className="tab">{d.rating ? `★ ${fmt(d.rating, 1)}` : "–"}</td>
                      <td><Pill tone={DSTATUS[d.status]?.[1]} dot={d.status !== "off"}>{DSTATUS[d.status]?.[0] ?? d.status}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      <Drawer open={!!open} onClose={() => setOpen(null)} label="Chauffeur" head={<h2 style={{ fontSize: 24 }}>{open === "new" ? "New chauffeur" : data?.rows.find((r) => r.id === open)?.name}</h2>}>
        {open && <DriverForm key={open} d={data?.rows.find((r) => r.id === open) ?? null} masked={!!data?.masked} onClose={() => setOpen(null)} onSaved={reload} />}
      </Drawer>
    </>
  );
}

function DriverForm({ d, masked, onClose, onSaved }: { d: Driver | null; masked: boolean; onClose: () => void; onSaved: () => void }) {
  const { f, set } = useForm({
    name: d?.name ?? "", phone: d?.phone ?? "", cnic: d?.cnic ?? "", licence_no: d?.licence_no ?? "", licence_type: d?.licence_type ?? "LTV", licence_expiry: d?.licence_expiry ?? "",
    languages: d?.languages ?? ["Urdu"], cities: d?.cities ?? [], drives: d?.drives ?? "", rating: numStr(d?.rating), photo_url: d?.photo_url ?? null, status: d?.status ?? "available", notes: d?.notes ?? "",
  });
  const me = useMe();
  const canSave = useCan("cars.drivers", d ? "edit" : "create");
  const canDelete = useCan("cars.drivers", "delete");
  const { busy, run } = useAction();
  const del = useDelete();
  async function save() {
    const body = { ...f, phone: f.phone || null, cnic: f.cnic || null, licence_no: f.licence_no || null, licence_type: f.licence_type || null, licence_expiry: f.licence_expiry || null, drives: f.drives || null, rating: toNum(f.rating), notes: f.notes || null };
    const out = await run(() => (d ? api.put(`/cars/drivers/${d.id}`, body) : api.post("/cars/drivers", body)), d ? "Chauffeur saved" : "Chauffeur added");
    if (out) { onSaved(); onClose(); }
  }
  const cnicHint = masked && d ? "Hidden for your role. Leave it as is to keep it, or type a new one." : "e.g. 35202-1234567-1";
  return (
    <>
      <div className="f-grid">
        <Field label="Name"><Input value={f.name} onChange={(e) => set("name")(e.target.value)} /></Field>
        <Field label="Phone"><Input type="tel" value={f.phone} onChange={(e) => set("phone")(e.target.value)} /></Field>
        <Field label="CNIC" hint={cnicHint}><Input value={f.cnic} onChange={(e) => set("cnic")(e.target.value)} onFocus={(e) => masked && e.target.value.includes("•") && e.target.select()} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status")(e.target.value)} options={Object.entries(DSTATUS).map(([value, [label]]) => ({ value, label }))} /></Field>
        <Field label="Licence number"><Input value={f.licence_no} onChange={(e) => set("licence_no")(e.target.value)} /></Field>
        <Field label="Licence type"><Select value={f.licence_type} onChange={(e) => set("licence_type")(e.target.value)} options={[...new Set(["LTV", "HTV", "LTV + HTV", "PSV", f.licence_type])].filter(Boolean)} /></Field>
        <Field label="Licence valid until"><Input type="date" value={f.licence_expiry} onChange={(e) => set("licence_expiry")(e.target.value)} /></Field>
        <Field label="Rating" hint="Out of 5"><NumInput value={f.rating} onChange={set("rating")} step={0.1} /></Field>
        <Field label="Languages" className="span-all"><Tags value={f.languages} onChange={set("languages")} placeholder="e.g. Pashto" /></Field>
        <Field label="Cities" className="span-all"><Tags value={f.cities} onChange={set("cities")} placeholder="e.g. Islamabad" /></Field>
        <Field label="Drives" className="span-all" hint="e.g. Prado, Fortuner"><Input value={f.drives} onChange={(e) => set("drives")(e.target.value)} /></Field>
        <Field label="Notes" className="span-all"><Textarea rows={2} value={f.notes} onChange={(e) => set("notes")(e.target.value)} /></Field>
      </div>
      <Field label="Photo"><ImageUpload value={f.photo_url} onChange={set("photo_url")} folder="general" aspect="1/1" /></Field>
      {me.limits.maskIds && !d && <p className="muted" style={{ margin: 0 }}>After saving, the CNIC is hidden for your role.</p>}
      <div className="row svc-foot">
        {canSave && <Btn variant="gold" icon="check" busy={busy} onClick={save}>{d ? "Save chauffeur" : "Add chauffeur"}</Btn>}
        <span style={{ flex: 1 }} />
        {d && canDelete && <Btn variant="danger" icon="trash" onClick={async () => { if (await del(`/cars/drivers/${d.id}`, "this chauffeur")) { onSaved(); onClose(); } }}>Delete</Btn>}
      </div>
    </>
  );
}


