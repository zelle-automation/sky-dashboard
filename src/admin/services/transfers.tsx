"use client";
// Transfers: airport routes, city-to-city routes (both priced per vehicle type) with their rules, and vehicle types.
import { useState } from "react";
import { api, useData } from "../api";
import { fmt } from "../format";
import { useCan } from "../shell";
import {
  Btn, Drawer, Empty, ErrorNote, Field, Icon, ImageUpload, Input, KV, Loading, PageHead, Panel, Pill, Select, SwitchRow, Textarea,
} from "../ui";
import { cellPrice, duration, LiveSwitch, NumInput, numStr, rowProps, SubHead, toNum, useAction, useDelete, useForm } from "./common";

export type Vehicle = { id: string; name: string; examples: string | null; passengers: number; bags: number; units: number; used_for: string; photo_url: string | null; is_active: boolean; sort_order: number; routes: number };
type Route = {
  id: string; kind: "airport" | "intercity"; airport_code: string | null; from_label: string; to_label: string; distance_km: number | null; duration_min: number | null;
  meet_greet: boolean; notes: string | null; currency_code: string; is_live: boolean; sort_order: number; prices: Record<string, number>;
};
type AirportRules = { free_wait_min: number; night_surcharge_pct: number; night_from: string; night_to: string; cutoff_hours: number; child_seat_price: number; extra_stop_price: number; flight_tracking: boolean; name_board: boolean; whatsapp_driver: boolean };
type CityRules = { return_discount_pct: number; stopover_per_hour: number; driver_overnight: number; northern_suv_only: boolean; tolls_included: boolean };

const vIcon = (name: string) => (/van|coaster|bus|hiace/i.test(name) ? "van" : "car") as "van" | "car";

function Head({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return <PageHead eyebrow="Transfers" title={title} sub={sub}>{children}</PageHead>;
}

/* ================= routes ================= */

export function RoutesTab({ kind, label }: { kind: "airport" | "intercity"; label: string }) {
  const { data, error, loading, reload, setData } = useData<Route[]>(`/transfers/routes?kind=${kind}`);
  const veh = useData<Vehicle[]>("/transfers/vehicles");
  const vehicles = (veh.data ?? []).filter((v) => v.is_active);
  const key = `transfers.${kind}`;
  const canCreate = useCan(key, "create");
  const canEdit = useCan(key, "edit");
  const [open, setOpen] = useState<string | null>(null);
  const air = kind === "airport";
  const rows = data ?? [];
  return (
    <>
      <Head title={label} sub={air ? "Pickups from the airport to the hotel, and drop-offs back. Prices are per vehicle, one way." : "One-way prices per vehicle between cities. Return trips get the discount set below."}>
        {canCreate && <Btn variant="gold" icon="plus" onClick={() => setOpen("new")}>{air ? "Add airport" : "Add route"}</Btn>}
      </Head>
      <ErrorNote error={error || veh.error} />
      {loading && !data ? <Loading /> : (
        <Panel className="svc-mb">
          {!rows.length ? <Empty icon="route" title="No routes yet" /> : (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    {air ? <><th>Airport</th><th>Serves</th></> : <><th>From</th><th>To</th><th>Distance</th><th>Drive time</th></>}
                    {vehicles.map((v) => <th key={v.id} className="num">{v.name}</th>)}
                    {air && <th>Meet &amp; greet</th>}
                    <th>Live</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} {...rowProps(() => setOpen(r.id))}>
                      {air ? <><td><b>{r.from_label}</b></td><td>{r.to_label}</td></> : <>
                        <td><b>{r.from_label}</b></td><td><b>{r.to_label}</b></td>
                        <td className="tab">{r.distance_km != null ? `${fmt(r.distance_km)} km` : "–"}</td><td className="tab">{duration(r.duration_min)}</td>
                      </>}
                      {vehicles.map((v) => <td key={v.id} className="num tab">{cellPrice(r.prices[v.id])}</td>)}
                      {air && <td><Pill tone={r.meet_greet ? "good" : "plain"}>{r.meet_greet ? "Included" : "No"}</Pill></td>}
                      <td><LiveSwitch on={r.is_live} label={`${r.from_label} to ${r.to_label}`} path={`/transfers/routes/${r.id}`} field="is_live" disabled={!canEdit} onDone={(v) => setData((d) => d && d.map((x) => (x.id === r.id ? { ...x, is_live: v } : x)))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      {air ? <AirportRulesPanel /> : <CityRulesPanel />}
      <Drawer open={!!open} onClose={() => setOpen(null)} label="Route" head={<h2 style={{ fontSize: 24 }}>{open === "new" ? (air ? "Add airport" : "Add route") : "Edit route"}</h2>}>
        {open && <RouteForm key={open} kind={kind} r={rows.find((x) => x.id === open) ?? null} vehicles={veh.data ?? []} onClose={() => setOpen(null)} onSaved={reload} />}
      </Drawer>
    </>
  );
}

function RouteForm({ kind, r, vehicles, onClose, onSaved }: { kind: "airport" | "intercity"; r: Route | null; vehicles: Vehicle[]; onClose: () => void; onSaved: () => void }) {
  const air = kind === "airport";
  const { f, setF, set } = useForm({
    airport_code: r?.airport_code ?? "", from_label: r?.from_label ?? "", to_label: r?.to_label ?? "", distance_km: numStr(r?.distance_km),
    hours: r?.duration_min != null ? String(Math.floor(r.duration_min / 60)) : "", mins: r?.duration_min != null ? String(r.duration_min % 60) : "",
    meet_greet: r?.meet_greet ?? true, notes: r?.notes ?? "", is_live: r?.is_live ?? true, sort_order: String(r?.sort_order ?? 0),
    prices: Object.fromEntries(vehicles.map((v) => [v.id, numStr(r?.prices[v.id])])) as Record<string, string>,
  });
  const key = `transfers.${kind}`;
  const canSave = useCan(key, r ? "edit" : "create");
  const canDelete = useCan(key, "delete");
  const { busy, run } = useAction();
  const del = useDelete();
  async function save() {
    const dur = f.hours || f.mins ? (Number(f.hours) || 0) * 60 + (Number(f.mins) || 0) : null;
    const body = {
      kind, airport_code: air ? f.airport_code : f.airport_code || null, from_label: f.from_label, to_label: f.to_label, distance_km: toNum(f.distance_km), duration_min: dur,
      meet_greet: f.meet_greet, notes: f.notes || null, is_live: f.is_live, sort_order: toNum(f.sort_order) ?? 0,
      prices: Object.fromEntries(Object.entries(f.prices).map(([k, v]) => [k, toNum(v)])),
    };
    const out = await run(() => (r ? api.put(`/transfers/routes/${r.id}`, body) : api.post("/transfers/routes", body)), r ? "Route saved" : "Route added");
    if (out) { onSaved(); onClose(); }
  }
  return (
    <>
      <div className="f-grid">
        {air ? <>
          <Field label="Airport code" hint="3 letters, e.g. JED"><Input value={f.airport_code} maxLength={3} onChange={(e) => set("airport_code")(e.target.value.toUpperCase())} /></Field>
          <Field label="Airport, shown as" hint="e.g. Jeddah (JED)"><Input value={f.from_label} onChange={(e) => set("from_label")(e.target.value)} /></Field>
          <Field label="Serves" hint="Zone or city, e.g. Makkah hotels" className="span-all"><Input value={f.to_label} onChange={(e) => set("to_label")(e.target.value)} /></Field>
        </> : <>
          <Field label="From"><Input value={f.from_label} onChange={(e) => set("from_label")(e.target.value)} /></Field>
          <Field label="To"><Input value={f.to_label} onChange={(e) => set("to_label")(e.target.value)} /></Field>
          <Field label="Distance"><NumInput value={f.distance_km} onChange={set("distance_km")} pre="km" /></Field>
          <Field label="Drive time">
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <NumInput aria-label="Hours" value={f.hours} onChange={set("hours")} pre="h" />
              <NumInput aria-label="Minutes" value={f.mins} onChange={set("mins")} pre="min" />
            </div>
          </Field>
        </>}
      </div>
      <Panel className="svc-inner">
        <SubHead>Price per vehicle, one way</SubHead>
        <p className="muted" style={{ margin: 0 }}>Leave a vehicle empty when it isn’t offered on this route.</p>
        <div className="f-grid">
          {vehicles.map((v) => (
            <Field key={v.id} label={`${v.name}${v.is_active ? "" : " (switched off)"}`} hint={`${v.passengers} passengers · ${v.bags} bags`}>
              <NumInput value={f.prices[v.id] ?? ""} onChange={(val) => setF((x) => ({ ...x, prices: { ...x.prices, [v.id]: val } }))} pre="PKR" />
            </Field>
          ))}
        </div>
      </Panel>
      <div className="f-grid">
        <Field label="Notes for the team" className="span-all"><Textarea rows={2} value={f.notes} onChange={(e) => set("notes")(e.target.value)} /></Field>
        <Field label="Order in list"><NumInput value={f.sort_order} onChange={set("sort_order")} /></Field>
      </div>
      <div>
        {air && <SwitchRow title="Meet & greet included" sub="Driver waits in arrivals" checked={f.meet_greet} onChange={set("meet_greet")} />}
        <SwitchRow title="Live on the website" checked={f.is_live} onChange={set("is_live")} />
      </div>
      <div className="row svc-foot">
        {canSave && <Btn variant="gold" icon="check" busy={busy} onClick={save}>{r ? "Save route" : "Add route"}</Btn>}
        <span style={{ flex: 1 }} />
        {r && canDelete && <Btn variant="danger" icon="trash" onClick={async () => { if (await del(`/transfers/routes/${r.id}`, "this route")) { onSaved(); onClose(); } }}>Delete</Btn>}
      </div>
    </>
  );
}

/* ================= rules ================= */

function useRules<T extends object>(kind: string) {
  const { data, error, loading, setData } = useData<T>(`/transfers/rules/${kind}`);
  const canEdit = useCan(`transfers.${kind}`, "edit");
  const { busy, run } = useAction();
  const [draft, setDraft] = useState<T | null>(null);
  const v = draft ?? data;
  const set = <K extends keyof T>(k: K) => (val: T[K]) => setDraft((d) => ({ ...(d ?? data!), [k]: val }));
  const save = async () => {
    const out = await run(() => api.put<T>(`/transfers/rules/${kind}`, draft), "Rules saved");
    if (out) { setData(out); setDraft(null); }
  };
  return { v, error, loading, canEdit, busy, set, save, dirty: !!draft };
}
const numSet = (fn: (v: number) => void) => (s: string) => fn(Number(s) || 0);

function AirportRulesPanel() {
  const { v, error, canEdit, busy, set, save, dirty } = useRules<AirportRules>("airport");
  if (error) return <ErrorNote error={error} />;
  if (!v) return <Loading />;
  const sel = (vals: number[], unit: string) => vals.map((n) => ({ value: String(n), label: `${n} ${unit}` }));
  return (
    <Panel title="Airport rules" className="svc-rules" actions={canEdit && dirty ? <Btn size="sm" variant="gold" icon="check" busy={busy} onClick={save}>Save rules</Btn> : undefined}>
      <div className="f-grid c3">
        <Field label="Free waiting after landing"><Select value={String(v.free_wait_min)} onChange={(e) => set("free_wait_min")(Number(e.target.value))} options={sel([...new Set([30, 45, 60, 90, 120, v.free_wait_min])].sort((a, b) => a - b), "minutes")} /></Field>
        <Field label="Book at least"><Select value={String(v.cutoff_hours)} onChange={(e) => set("cutoff_hours")(Number(e.target.value))} options={[...new Set([3, 6, 12, 24, 48, v.cutoff_hours])].sort((a, b) => a - b).map((n) => ({ value: String(n), label: `${n} hours before` }))} /></Field>
        <Field label="Child seat"><NumInput value={String(v.child_seat_price)} onChange={numSet(set("child_seat_price"))} pre="PKR" /></Field>
        <Field label={`Night surcharge ${v.night_from}–${v.night_to}`}><NumInput value={String(v.night_surcharge_pct)} onChange={numSet(set("night_surcharge_pct"))} pre="%" /></Field>
        <Field label="Night starts"><Input type="time" value={v.night_from} onChange={(e) => set("night_from")(e.target.value)} /></Field>
        <Field label="Night ends"><Input type="time" value={v.night_to} onChange={(e) => set("night_to")(e.target.value)} /></Field>
        <Field label="Extra stop"><NumInput value={String(v.extra_stop_price)} onChange={numSet(set("extra_stop_price"))} pre="PKR" /></Field>
      </div>
      <div style={{ marginTop: 8 }}>
        <SwitchRow title="Track flight and adjust pickup time" checked={v.flight_tracking} onChange={set("flight_tracking")} disabled={!canEdit} />
        <SwitchRow title="Name board at arrivals" checked={v.name_board} onChange={set("name_board")} disabled={!canEdit} />
        <SwitchRow title="Send driver details by WhatsApp" checked={v.whatsapp_driver} onChange={set("whatsapp_driver")} disabled={!canEdit} />
      </div>
    </Panel>
  );
}

function CityRulesPanel() {
  const { v, error, canEdit, busy, set, save, dirty } = useRules<CityRules>("intercity");
  if (error) return <ErrorNote error={error} />;
  if (!v) return <Loading />;
  return (
    <Panel title="Route rules" className="svc-rules" actions={canEdit && dirty ? <Btn size="sm" variant="gold" icon="check" busy={busy} onClick={save}>Save rules</Btn> : undefined}>
      <div className="f-grid c3">
        <Field label="Return trip discount"><NumInput value={String(v.return_discount_pct)} onChange={numSet(set("return_discount_pct"))} pre="%" /></Field>
        <Field label="Stopover" hint="Per hour"><NumInput value={String(v.stopover_per_hour)} onChange={numSet(set("stopover_per_hour"))} pre="PKR" /></Field>
        <Field label="Driver overnight" hint="Per night"><NumInput value={String(v.driver_overnight)} onChange={numSet(set("driver_overnight"))} pre="PKR" /></Field>
      </div>
      <div style={{ marginTop: 8 }}>
        <SwitchRow title="Northern routes need an SUV or van" checked={v.northern_suv_only} onChange={set("northern_suv_only")} disabled={!canEdit} />
        <SwitchRow title="Tolls and parking included" checked={v.tolls_included} onChange={set("tolls_included")} disabled={!canEdit} />
      </div>
    </Panel>
  );
}

/* ================= vehicles ================= */

export function VehiclesTab({ label }: { label: string }) {
  const { data, error, loading, reload, setData } = useData<Vehicle[]>("/transfers/vehicles");
  const canCreate = useCan("transfers.vehicles", "create");
  const canEdit = useCan("transfers.vehicles", "edit");
  const [open, setOpen] = useState<string | null>(null);
  const rows = data ?? [];
  return (
    <>
      <Head title={label} sub="Vehicle types used for airport transfers, city to city trips and car rental.">
        {canCreate && <Btn variant="gold" icon="plus" onClick={() => setOpen("new")}>Add vehicle type</Btn>}
      </Head>
      <ErrorNote error={error} />
      {loading && !data ? <Loading /> : !rows.length ? <Panel><Empty icon="car" title="No vehicle types yet" /></Panel> : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))" }}>
          {rows.map((v) => (
            <div key={v.id} {...rowProps(() => setOpen(v.id))} className={`panel svc-vcard${v.is_active ? "" : " svc-dim"}`}>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                {v.photo_url ? <div className="svc-vimg" style={{ backgroundImage: `url("${v.photo_url}")` }} /> : <div className="pm-ic"><Icon name={vIcon(v.name)} /></div>}
                <div style={{ flex: 1, minWidth: 0 }}><h2 style={{ fontSize: 20 }}>{v.name}</h2><div style={{ color: "var(--muted)", fontSize: 12.5 }}>{v.examples}</div></div>
                <LiveSwitch on={v.is_active} label={v.name} path={`/transfers/vehicles/${v.id}`} field="is_active" disabled={!canEdit} onDone={(val) => setData((d) => d && d.map((x) => (x.id === v.id ? { ...x, is_active: val } : x)))} />
              </div>
              <div style={{ marginTop: 14 }}>
                <KV items={[["Passengers", v.passengers], ["Large bags", v.bags], ["In fleet", v.units], ["Used for", v.used_for]]} />
              </div>
            </div>
          ))}
        </div>
      )}
      <Drawer open={!!open} onClose={() => setOpen(null)} label="Vehicle type" head={<h2 style={{ fontSize: 24 }}>{open === "new" ? "New vehicle type" : rows.find((r) => r.id === open)?.name}</h2>}>
        {open && <VehicleForm key={open} v={rows.find((r) => r.id === open) ?? null} onClose={() => setOpen(null)} onSaved={reload} />}
      </Drawer>
    </>
  );
}

function VehicleForm({ v, onClose, onSaved }: { v: Vehicle | null; onClose: () => void; onSaved: () => void }) {
  const { f, set } = useForm({
    name: v?.name ?? "", examples: v?.examples ?? "", passengers: String(v?.passengers ?? 3), bags: String(v?.bags ?? 2), units: String(v?.units ?? 1),
    used_for: v?.used_for ?? "All transfers", photo_url: v?.photo_url ?? null, is_active: v?.is_active ?? true, sort_order: String(v?.sort_order ?? 0),
  });
  const canSave = useCan("transfers.vehicles", v ? "edit" : "create");
  const canDelete = useCan("transfers.vehicles", "delete");
  const { busy, run } = useAction();
  const del = useDelete();
  async function save() {
    const body = { ...f, examples: f.examples || null, passengers: toNum(f.passengers), bags: toNum(f.bags), units: toNum(f.units), sort_order: toNum(f.sort_order) ?? 0 };
    const out = await run(() => (v ? api.put(`/transfers/vehicles/${v.id}`, body) : api.post("/transfers/vehicles", body)), v ? "Vehicle saved" : "Vehicle added");
    if (out) { onSaved(); onClose(); }
  }
  return (
    <>
      <div className="f-grid">
        <Field label="Type" hint="e.g. Sedan, SUV, Van, Coaster"><Input value={f.name} onChange={(e) => set("name")(e.target.value)} /></Field>
        <Field label="Example models" hint="e.g. Toyota Camry or similar"><Input value={f.examples} onChange={(e) => set("examples")(e.target.value)} /></Field>
        <Field label="Passengers"><NumInput value={f.passengers} onChange={set("passengers")} min={1} /></Field>
        <Field label="Large bags"><NumInput value={f.bags} onChange={set("bags")} /></Field>
        <Field label="In fleet"><NumInput value={f.units} onChange={set("units")} /></Field>
        <Field label="Used for"><Select value={f.used_for} onChange={(e) => set("used_for")(e.target.value)} options={[...new Set(["All transfers", "Airport transfers", "City to city", "Groups and Umrah", f.used_for])]} /></Field>
        <Field label="Order"><NumInput value={f.sort_order} onChange={set("sort_order")} /></Field>
      </div>
      <Field label="Photo"><ImageUpload value={f.photo_url} onChange={set("photo_url")} folder="general" aspect="16/9" /></Field>
      <SwitchRow title="Active" sub="Inactive types are hidden from prices and bookings" checked={f.is_active} onChange={set("is_active")} />
      {v && v.routes > 0 && <p className="muted" style={{ margin: 0 }}>Priced on {v.routes} routes. Deleting it removes those prices.</p>}
      <div className="row svc-foot">
        {canSave && <Btn variant="gold" icon="check" busy={busy} onClick={save}>{v ? "Save vehicle" : "Add vehicle"}</Btn>}
        <span style={{ flex: 1 }} />
        {v && canDelete && <Btn variant="danger" icon="trash" onClick={async () => { if (await del(`/transfers/vehicles/${v.id}`, "this vehicle type", v.routes ? `Its prices on ${v.routes} routes are removed too.` : undefined)) { onSaved(); onClose(); } }}>Delete</Btn>}
      </div>
    </>
  );
}
