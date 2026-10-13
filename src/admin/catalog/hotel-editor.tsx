"use client";
// Hotel editor: the 12 sections of the approved design, shown as sub-tabs in the left rail.
import { useMemo, useState } from "react";
import { ago, date, fmt, pkr, siteUrl, slugify } from "../format";
import { useCan } from "../shell";
import { Btn, Check, ErrorNote, Field, Icon, IconBtn, Input, KV, Loading, Pill, PreInput, Select, Stars, Switch, SwitchRow, Tags, Textarea } from "../ui";
import { AvailabilityGrid } from "./availability";
import {
  BADGES, BED_SETUPS, CANCEL_RULES, emptyHotel, emptyRate, emptyRoom, FACILITIES, hotelChecks, lowestRate, MEAL_PLANS, PAYMENTS, photoIssue,
  PROPERTY_TYPES, quality, ratePrice, SCORE_KEYS, SCORE_LABEL, SMOKING, SUPPLIERS, TAX_PER, VIEWS,
  type HotelDoc, type Policies, type RatePlan, type Review, type Room, type Tax,
} from "./model";
import { EditorFrame, Num, PhotoGrid, PreNum, QualityPanel, statusLabel, statusTone, ThumbStrip, UpRow, useDestinations, useEditorDoc, type EdSection } from "./parts";

type Meta = { updated_at: string; updated_by: string | null; price_from: number | null; stats: { bookings: number; nights: number; revenue: number } };

const ALL_FACILITIES = new Set(Object.values(FACILITIES).flat());
const PRIORITIES = [{ value: "10", label: "Top of list" }, { value: "5", label: "High" }, { value: "0", label: "Normal" }, { value: "-10", label: "Bottom" }];
const scoreWord = (s: number) => (s >= 9 ? "Superb" : s >= 8 ? "Very good" : s >= 7 ? "Good" : s >= 6 ? "Pleasant" : "Fair");

export function HotelEditor({ id }: { id: string }) {
  const ed = useEditorDoc<HotelDoc, Meta>("hotels", id, emptyHotel);
  const dests = useDestinations("hotels");
  const canEdit = useCan("hotels", ed.isNew ? "create" : "edit");
  const [openRoom, setOpenRoom] = useState<string | null>(null);
  const [openRev, setOpenRev] = useState<number | null>(null);
  const { doc, set } = ed;

  const price = useMemo(() => (doc ? lowestRate(doc.rooms, doc.rate_plans) : null), [doc]);
  if (ed.error) return <ErrorNote error={ed.error} />;
  if (ed.loading || !doc) return <Loading />;

  const dest = dests.find((d) => d.id === doc.destination_id);
  const pol = <K extends keyof Policies>(k: K, v: Policies[K]) => set("policies", { ...doc.policies, [k]: v });
  const setRoom = (i: number, p: Partial<Room>) => set("rooms", doc.rooms.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const setRate = (i: number, p: Partial<RatePlan>) => set("rate_plans", doc.rate_plans.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const setTax = (i: number, p: Partial<Tax>) => set("taxes", doc.taxes.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const setRev = (i: number, p: Partial<Review>) => set("reviews", doc.reviews.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const checks = hotelChecks(doc);
  const warn = (k: string) => {
    const c = checks.find((x) => x.section === k);
    return c && !c.ok ? (k === "photos" ? photoIssue(doc.photos, doc.voucher_image_url ?? "") : "Incomplete") : null;
  };
  const cur = doc.currency_code;
  const pct = quality(checks);
  const otherFacilities = doc.facilities.filter((f) => !ALL_FACILITIES.has(f));
  const toggleFacility = (f: string, on: boolean) => set("facilities", on ? [...doc.facilities, f] : doc.facilities.filter((x) => x !== f));

  const sections: EdSection[] = [
    {
      key: "basics", label: "Property basics", icon: "bed", sub: "What guests see first on the hotel page and in search.", warn: warn("basics"),
      body: (
        <div className="f-grid">
          <Field label="Property name"><Input value={doc.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ibis Dubai Al Rigga" /></Field>
          <Field label="Property type"><Select value={doc.kind} onChange={(e) => set("kind", e.target.value)} options={PROPERTY_TYPES.includes(doc.kind) ? PROPERTY_TYPES : [doc.kind, ...PROPERTY_TYPES]} /></Field>
          <div className="fld"><span className="lab">Star rating</span><Stars value={doc.star_rating ?? 0} onChange={(n) => set("star_rating", n || null)} /></div>
          <Field label="Brand or chain"><Input value={doc.chain} onChange={(e) => set("chain", e.target.value)} placeholder="Independent" /></Field>
          <Field label="Opened · last renovated">
            <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
              <Num value={doc.opened_year} onChange={(v) => set("opened_year", v)} placeholder="Opened" aria-label="Year opened" />
              <Num value={doc.renovated_year} onChange={(v) => set("renovated_year", v)} placeholder="Renovated" aria-label="Year last renovated" />
            </div>
          </Field>
          <Field label="Total rooms in property"><Num value={doc.total_rooms} onChange={(v) => set("total_rooms", v)} min={0} /></Field>
          <Field label="Badge on card"><Select value={doc.badge} onChange={(e) => set("badge", e.target.value)} placeholder="None" options={BADGES.includes(doc.badge) || !doc.badge ? BADGES : [doc.badge, ...BADGES]} /></Field>
          <Field label="Short summary" hint={`Shown on list cards · ${doc.summary.length} of 120 characters`}><Input value={doc.summary} maxLength={160} onChange={(e) => set("summary", e.target.value)} /></Field>
          <Field label="Full description" className="span-all"><Textarea rows={5} value={doc.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Highlights" hint="Up to 6, shown as chips on the card" className="span-all"><Tags value={doc.highlights} onChange={(v) => set("highlights", v.slice(0, 12))} /></Field>
          <Field label="Languages staff speak" className="span-all"><Tags value={doc.languages} onChange={(v) => set("languages", v)} /></Field>
        </div>
      ),
    },
    {
      key: "loc", label: "Location", icon: "pin", sub: "Address, map pin and how far guests are from what matters.", warn: warn("loc"),
      body: (
        <div className="f-grid">
          <Field label="Street address" className="span2"><Input value={doc.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="Area"><Input value={doc.area} onChange={(e) => set("area", e.target.value)} placeholder="e.g. Al Rigga, Deira" /></Field>
          <Field label="City"><Input value={doc.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="Destination page" hint="The hotel is listed on this destination’s page">
            <Select value={doc.destination_id ?? ""} placeholder="Not linked" options={dests.map((d) => ({ value: d.id, label: `${d.name}, ${d.country}` }))}
              onChange={(e) => { const d = dests.find((x) => x.id === e.target.value); set("destination_id", e.target.value || null); if (d && !doc.country) set("country", d.country); }} />
          </Field>
          <Field label="Country"><Input value={doc.country} onChange={(e) => set("country", e.target.value)} /></Field>
          <Field label="Postcode"><Input value={doc.postcode} onChange={(e) => set("postcode", e.target.value)} /></Field>
          <Field label="Map pin (latitude, longitude)">
            <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
              <Num value={doc.lat} step="0.0001" placeholder="Latitude" aria-label="Latitude" onChange={(v) => set("lat", v)} />
              <Num value={doc.lng} step="0.0001" placeholder="Longitude" aria-label="Longitude" onChange={(v) => set("lng", v)} />
            </div>
          </Field>
          <div className="span-all cat-map">
            <svg viewBox="0 0 600 170" preserveAspectRatio="none" aria-hidden="true"><path d="M0 120 C120 90 200 140 330 110 S520 70 600 92" stroke="var(--signal)" strokeWidth="2" fill="none" opacity=".5" /></svg>
            <div className="cat-pin"><Icon name="pin" /></div>
            <span className="pill" style={{ position: "absolute", left: 10, bottom: 10 }}>{doc.lat != null && doc.lng != null ? `${doc.lat.toFixed(4)}, ${doc.lng.toFixed(4)}` : "No map pin yet"}</span>
            {doc.lat != null && doc.lng != null && (
              <a className="btn btn-sm" style={{ position: "absolute", right: 10, bottom: 10, textDecoration: "none" }} href={`https://www.google.com/maps?q=${doc.lat},${doc.lng}`} target="_blank" rel="noreferrer"><Icon name="globe" />Check on Google Maps</a>
            )}
          </div>
          <div className="span-all">
            <span className="lab" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--muted)" }}>Distances</span>
            <div className="list" style={{ marginTop: 6 }}>
              {doc.distances.map((d, i) => (
                <div className="li" key={i}>
                  <Icon name={/airport/i.test(d.place) ? "plane" : /metro|station|monorail|train/i.test(d.place) ? "route" : "pin"} />
                  <Input className="grow" value={d.place} placeholder="Place" aria-label="Place" onChange={(e) => set("distances", doc.distances.map((x, j) => (j === i ? { ...x, place: e.target.value } : x)))} />
                  <Input style={{ width: 110 }} value={d.distance} placeholder="2 km" aria-label="Distance" onChange={(e) => set("distances", doc.distances.map((x, j) => (j === i ? { ...x, distance: e.target.value } : x)))} />
                  <IconBtn icon="x" label="Remove place" onClick={() => set("distances", doc.distances.filter((_, j) => j !== i))} />
                </div>
              ))}
            </div>
            <Btn size="sm" variant="ghost" icon="plus" style={{ marginTop: 6 }} onClick={() => set("distances", [...doc.distances, { place: "", distance: "" }])}>Add place</Btn>
          </div>
        </div>
      ),
    },
    {
      key: "photos", label: "Photos & logo", icon: "image", sub: "The logo and voucher photo print on hotel vouchers. Website photos come in day and evening pairs; the first pair is the cover.", warn: warn("photos"),
      body: (
        <>
          <div className="grid g-2" style={{ marginBottom: 16 }}>
            <UpRow title="Hotel logo" hint="Printed on the hotel voucher. PNG with a transparent background, at least 400 px" value={doc.logo_url} onChange={(v) => set("logo_url", v)} folder="hotels" contain />
            <UpRow title="Voucher photo" hint="Printed next to the hotel name on vouchers" value={doc.voucher_image_url} onChange={(v) => set("voucher_image_url", v)} folder="hotels" />
          </div>
          <PhotoGrid value={doc.photos} onChange={(v) => set("photos", v)} folder="hotels" />
        </>
      ),
    },
    {
      key: "rooms", label: "Room types", icon: "bed", sub: "Each room type has its own size, beds, occupancy and amenities.", warn: warn("rooms"),
      body: (
        <>
          <div className="list">
            {doc.rooms.map((r, i) => {
              const isOpen = openRoom === r.key;
              return (
                <div key={r.key} className="li" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div className="thumb lg" style={r.photos[0] ? { backgroundImage: `url("${r.photos[0]}")` } : { display: "grid", placeItems: "center", color: "var(--faint)" }}>{!r.photos[0] && <Icon name="bed" />}</div>
                  <div className="grow" style={{ minWidth: 180 }}>
                    <b style={{ fontSize: 14 }}>{r.name || "New room type"}</b>
                    <div className="t2">{[r.size_m2 ? `${r.size_m2} m²` : null, r.beds, `sleeps ${r.max_adults} adult${r.max_adults === 1 ? "" : "s"}${r.max_children ? ` + ${r.max_children} child${r.max_children === 1 ? "" : "ren"}` : ""}`, `${r.units} unit${r.units === 1 ? "" : "s"}`, r.view ? `${r.view} view` : null].filter(Boolean).join(" · ")}</div>
                    {!isOpen && r.amenities.length > 0 && <div className="row" style={{ gap: 5, marginTop: 6 }}>{r.amenities.slice(0, 6).map((a) => <span className="tag" key={a}>{a}</span>)}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <b className="tab">{r.base_price ? pkr(r.base_price).replace("PKR", cur) : "–"}</b>
                    <div className="t2">base / night</div>
                    <div className="row" style={{ gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
                      <Btn size="sm" icon={isOpen ? "check" : "edit"} onClick={() => setOpenRoom(isOpen ? null : r.key)}>{isOpen ? "Done" : "Edit"}</Btn>
                      <IconBtn icon="trash" label={`Remove ${r.name || "room type"}`} onClick={() => { set("rooms", doc.rooms.filter((_, j) => j !== i)); set("rate_plans", doc.rate_plans.map((p) => (p.room_key === r.key ? { ...p, room_key: null } : p))); }} />
                    </div>
                  </div>
                  {isOpen && (
                    <div className="f-grid c3" style={{ flexBasis: "100%", marginTop: 8 }}>
                      <Field label="Room name"><Input value={r.name} onChange={(e) => setRoom(i, { name: e.target.value })} placeholder="e.g. Deluxe King, sea view" /></Field>
                      <Field label="Size"><PreNum pre="m²" value={r.size_m2} onChange={(v) => setRoom(i, { size_m2: v })} min={0} /></Field>
                      <Field label="Units to sell"><Num value={r.units} min={0} onChange={(v) => setRoom(i, { units: v ?? 0 })} /></Field>
                      <Field label="Bed setup"><Select value={r.beds} onChange={(e) => setRoom(i, { beds: e.target.value })} options={BED_SETUPS.includes(r.beds) ? BED_SETUPS : [r.beds, ...BED_SETUPS]} /></Field>
                      <Field label="Max adults"><Select value={String(r.max_adults)} onChange={(e) => setRoom(i, { max_adults: Number(e.target.value) })} options={["1", "2", "3", "4", "5", "6", "8"]} /></Field>
                      <Field label="Max children"><Select value={String(r.max_children)} onChange={(e) => setRoom(i, { max_children: Number(e.target.value) })} options={["0", "1", "2", "3", "4"]} /></Field>
                      <Field label="View"><Select value={r.view} onChange={(e) => setRoom(i, { view: e.target.value })} options={VIEWS.includes(r.view) || !r.view ? VIEWS : [r.view, ...VIEWS]} /></Field>
                      <Field label="Smoking"><Select value={r.smoking} onChange={(e) => setRoom(i, { smoking: e.target.value })} options={SMOKING} /></Field>
                      <Field label="Extra bed"><Input value={r.extra_bed} list="cat-extra" onChange={(e) => setRoom(i, { extra_bed: e.target.value })} /></Field>
                      <Field label="Base price per night"><PreNum pre={cur} value={r.base_price} min={0} onChange={(v) => setRoom(i, { base_price: v ?? 0 })} /></Field>
                      <Field label="Room amenities" className="span-all"><Tags value={r.amenities} onChange={(v) => setRoom(i, { amenities: v })} /></Field>
                      <Field label="Room photos" className="span-all"><ThumbStrip value={r.photos} onChange={(v) => setRoom(i, { photos: v })} folder="hotels" /></Field>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <datalist id="cat-extra"><option value="Not available" /><option value="Available, PKR 9,000 / night" /><option value="Free for children under 6" /></datalist>
          <Btn size="sm" icon="plus" style={{ marginTop: 12 }} onClick={() => { const r = emptyRoom(); set("rooms", [...doc.rooms, r]); setOpenRoom(r.key); }}>Add room type</Btn>
        </>
      ),
    },
    {
      key: "rates", label: "Rate plans", icon: "tag", sub: "Different prices for the same room, based on meals, cancellation and payment.", warn: warn("rates"),
      body: (
        <>
          <div className="list">
            {doc.rate_plans.map((p, i) => {
              const rooms = doc.rooms.filter((r) => r.base_price > 0 && (!p.room_key || p.room_key === r.key));
              const from = rooms.length ? Math.min(...rooms.map((r) => ratePrice(r.base_price, p))) : null;
              return (
                <div key={p.key} className="li cat-rate">
                  <Field label="Rate plan" className="cat-rate-name"><Input value={p.name} placeholder="e.g. Bed & breakfast · Flexible" onChange={(e) => setRate(i, { name: e.target.value })} /></Field>
                  <Field label="Room"><Select value={p.room_key ?? ""} onChange={(e) => setRate(i, { room_key: e.target.value || null })} options={[{ value: "", label: "All rooms" }, ...doc.rooms.map((r) => ({ value: r.key, label: r.name || "New room type" }))]} /></Field>
                  <Field label="Meals"><Select value={p.meal_plan} onChange={(e) => setRate(i, { meal_plan: e.target.value })} options={MEAL_PLANS.includes(p.meal_plan) ? MEAL_PLANS : [p.meal_plan, ...MEAL_PLANS]} /></Field>
                  <Field label="Cancellation"><Select value={p.cancellation} onChange={(e) => setRate(i, { cancellation: e.target.value })} options={CANCEL_RULES.includes(p.cancellation) ? CANCEL_RULES : [p.cancellation, ...CANCEL_RULES]} /></Field>
                  <Field label="Payment"><Select value={p.payment} onChange={(e) => setRate(i, { payment: e.target.value as RatePlan["payment"] })} options={PAYMENTS} /></Field>
                  <Field label="Price vs base">
                    <div className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
                      <Select value={p.adjust_type} aria-label="Change type" style={{ width: 84, flex: "none" }} onChange={(e) => setRate(i, { adjust_type: e.target.value as RatePlan["adjust_type"] })} options={[{ value: "percent", label: "%" }, { value: "fixed", label: cur }]} />
                      <Num value={p.adjust_value} aria-label="Change vs base price" onChange={(v) => setRate(i, { adjust_value: v ?? 0 })} />
                    </div>
                  </Field>
                  <div className="cat-rate-end">
                    <div style={{ textAlign: "right" }}>
                      <b className="tab">{from != null ? `${cur} ${fmt(from)}` : "–"}</b>
                      <div className="t2">{p.cancellation === "Non-refundable" ? <span style={{ color: "var(--bad)" }}>Non-refundable</span> : "from / night"}</div>
                    </div>
                    <Switch checked={p.is_live} onChange={(v) => setRate(i, { is_live: v })} label={`${p.name || "Rate plan"} live`} />
                    <IconBtn icon="trash" label="Remove rate plan" onClick={() => set("rate_plans", doc.rate_plans.filter((_, j) => j !== i))} />
                  </div>
                </div>
              );
            })}
          </div>
          {!doc.rate_plans.length && <div className="faint" style={{ fontSize: 13, padding: "6px 0" }}>No rate plans yet, so guests see each room’s base price.</div>}
          <div className="row" style={{ marginTop: 10 }}>
            <Btn size="sm" icon="plus" onClick={() => set("rate_plans", [...doc.rate_plans, emptyRate()])}>Add rate plan</Btn>
            <span className="spacer" />
            <span className="muted" style={{ fontSize: 13 }}>Website shows from <b style={{ color: "var(--gold)" }}>{price != null ? `${cur} ${fmt(price)}` : "–"}</b> per night</span>
          </div>
          <div className="f-grid c3" style={{ marginTop: 14 }}>
            <Field label="Minimum stay"><Select value={String(doc.policies.min_stay)} onChange={(e) => pol("min_stay", Number(e.target.value))} options={[1, 2, 3, 4, 5, 7].map((n) => ({ value: String(n), label: `${n} night${n > 1 ? "s" : ""}` }))} /></Field>
            <Field label="Book at least"><Select value={String(doc.policies.lead_days)} onChange={(e) => pol("lead_days", Number(e.target.value))} options={[{ value: "0", label: "Same day" }, { value: "1", label: "1 day ahead" }, { value: "3", label: "3 days ahead" }, { value: "7", label: "7 days ahead" }]} /></Field>
            <Field label="Children stay free until age"><Select value={String(doc.policies.child_free_age)} onChange={(e) => pol("child_free_age", Number(e.target.value))} options={["0", "2", "5", "6", "11", "12"]} /></Field>
          </div>
        </>
      ),
    },
    {
      key: "avail", label: "Availability & prices", icon: "cal", sub: "Rooms left and nightly price for the next 14 days. Click a day to change it.",
      body: (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <Field label="Weekend uplift (Fri & Sat nights)" hint="Applies to nights without a hand-set price, after saving">
              <PreNum pre="%" value={doc.weekend_uplift} onChange={(v) => set("weekend_uplift", v ?? 0)} style={{ width: 90 }} />
            </Field>
          </div>
          {ed.isNew || !doc.id ? <div className="faint" style={{ fontSize: 13 }}>Save the hotel first to manage nightly prices.</div> : <AvailabilityGrid hotelId={doc.id} canEdit={canEdit} version={ed.meta?.updated_at ?? ""} currency={cur} />}
        </>
      ),
    },
    {
      key: "amen", label: "Facilities", icon: "check", sub: "Guests filter by these, so tick everything the property really has.", warn: warn("amen"),
      body: (
        <>
          <div className="grid g-3" style={{ gap: "6px 24px" }}>
            {Object.entries(FACILITIES).map(([g, list]) => (
              <div key={g}>
                <div className="eyebrow" style={{ fontSize: 10, margin: "8px 0 4px" }}>{g}</div>
                {list.map((f) => <Check key={f} label={f} checked={doc.facilities.includes(f)} onChange={(v) => toggleFacility(f, v)} />)}
              </div>
            ))}
          </div>
          <Field label="Other facilities" hint="Anything not in the lists above" className="span-all"><Tags value={otherFacilities} onChange={(v) => set("facilities", [...doc.facilities.filter((f) => ALL_FACILITIES.has(f)), ...v])} /></Field>
        </>
      ),
    },
    {
      key: "pol", label: "House rules & policies", icon: "shield", sub: "Shown before payment and printed on the voucher.", warn: warn("pol"),
      body: (
        <>
          <div className="f-grid c4">
            <Field label="Check-in from"><Input type="time" value={doc.check_in_time} onChange={(e) => set("check_in_time", e.target.value)} /></Field>
            <Field label="Check-in until"><Input value={doc.policies.check_in_until} onChange={(e) => pol("check_in_until", e.target.value)} placeholder="Midnight" /></Field>
            <Field label="Check-out from"><Input value={doc.policies.check_out_from} onChange={(e) => pol("check_out_from", e.target.value)} placeholder="06:00" /></Field>
            <Field label="Check-out until"><Input type="time" value={doc.check_out_time} onChange={(e) => set("check_out_time", e.target.value)} /></Field>
          </div>
          <div className="f-grid" style={{ marginTop: 14 }}>
            <Field label="Cancellation policy"><Textarea rows={3} value={doc.policies.cancellation} onChange={(e) => pol("cancellation", e.target.value)} /></Field>
            <Field label="Children & extra beds"><Textarea rows={3} value={doc.policies.children} onChange={(e) => pol("children", e.target.value)} /></Field>
            <Field label="Minimum check-in age"><Select value={doc.policies.min_age} onChange={(e) => pol("min_age", e.target.value)} options={["18", "21", "No restriction"]} /></Field>
            <Field label="Pets"><Select value={doc.policies.pets} onChange={(e) => pol("pets", e.target.value)} options={["Not allowed", "Allowed on request", "Allowed, charges apply"]} /></Field>
            <Field label="Security deposit at check-in"><Input value={doc.policies.deposit} onChange={(e) => pol("deposit", e.target.value)} placeholder="e.g. AED 500 per night, or none" /></Field>
            <Field label="Cards accepted at the hotel"><Tags value={doc.policies.cards} onChange={(v) => pol("cards", v)} /></Field>
          </div>
          <div style={{ marginTop: 8 }}>
            <SwitchRow title="Passport or ID required at check-in" checked={doc.policies.id_required} onChange={(v) => pol("id_required", v)} />
            <SwitchRow title="Couples must show a marriage certificate" checked={doc.policies.marriage_cert} onChange={(v) => pol("marriage_cert", v)} />
            <SwitchRow title="Smoking allowed in designated areas only" checked={doc.policies.smoking_areas} onChange={(v) => pol("smoking_areas", v)} />
            <SwitchRow title="Parties and events not allowed" checked={doc.policies.no_parties} onChange={(v) => pol("no_parties", v)} />
            <SwitchRow title="Quiet hours 23:00 to 07:00" checked={doc.policies.quiet_hours} onChange={(v) => pol("quiet_hours", v)} />
          </div>
        </>
      ),
    },
    {
      key: "tax", label: "Taxes & fees", icon: "file", sub: "Local taxes, so the price guests see is the price they pay.",
      body: (
        <>
          <div className="tbl-wrap">
            <table className="cat-edit">
              <thead><tr><th>Charge</th><th>Type</th><th>Amount</th><th>Applies</th><th>In price</th><th /></tr></thead>
              <tbody>
                {doc.taxes.map((t, i) => (
                  <tr key={i}>
                    <td><Input value={t.name} aria-label="Charge name" style={{ minWidth: 160 }} onChange={(e) => setTax(i, { name: e.target.value })} /></td>
                    <td><Select value={t.type} aria-label="Type" onChange={(e) => setTax(i, { type: e.target.value as Tax["type"] })} options={[{ value: "percent", label: "Percent" }, { value: "fixed", label: "Fixed amount" }]} /></td>
                    <td>
                      <div className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
                        <Num value={t.amount} aria-label="Amount" style={{ width: 90 }} min={0} step="0.1" onChange={(v) => setTax(i, { amount: v ?? 0 })} />
                        {t.type === "percent" ? <span className="muted">%</span> : <Input value={t.currency} aria-label="Currency" maxLength={3} style={{ width: 70 }} onChange={(e) => setTax(i, { currency: e.target.value.toUpperCase() })} />}
                      </div>
                    </td>
                    <td><Select value={t.per} aria-label="Applies" onChange={(e) => setTax(i, { per: e.target.value as Tax["per"] })} options={TAX_PER} /></td>
                    <td><Select value={t.included ? "1" : "0"} aria-label="In price" onChange={(e) => setTax(i, { included: e.target.value === "1" })} options={[{ value: "1", label: "Included" }, { value: "0", label: "Paid at hotel" }]} /></td>
                    <td><IconBtn icon="trash" label="Remove charge" onClick={() => set("taxes", doc.taxes.filter((_, j) => j !== i))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!doc.taxes.length && <div className="faint" style={{ fontSize: 13, padding: "6px 0" }}>No taxes or fees added.</div>}
          <div className="row" style={{ marginTop: 10 }}>
            <Btn size="sm" icon="plus" onClick={() => set("taxes", [...doc.taxes, { name: "", type: "percent", amount: 0, currency: cur, per: "stay", included: true }])}>Add charge</Btn>
            {!doc.taxes.length && (
              <Btn size="sm" variant="ghost" onClick={() => set("taxes", [
                { name: "VAT", type: "percent", amount: 5, currency: "AED", per: "stay", included: true },
                { name: "Municipality fee", type: "percent", amount: 7, currency: "AED", per: "stay", included: true },
                { name: "Service charge", type: "percent", amount: 10, currency: "AED", per: "stay", included: true },
                { name: "Tourism Dirham", type: "fixed", amount: 20, currency: "AED", per: "room_night", included: false },
              ])}>Use Dubai taxes</Btn>
            )}
          </div>
        </>
      ),
    },
    {
      key: "contact", label: "Hotel contact", icon: "phone", sub: "Printed on the voucher under Hotel contact, so guests can reach the property.", warn: warn("contact"),
      body: (
        <>
          <div className="f-grid">
            <Field label="Front desk phone"><Input value={doc.phone} type="tel" onChange={(e) => set("phone", e.target.value)} placeholder="+971 4 206 8100" /></Field>
            <Field label="Reservations email"><Input value={doc.email} type="email" onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Website" hint="Optional"><Input value={doc.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" /></Field>
            <Field label="Emergency contact at hotel" hint="Optional, night manager or duty phone"><Input value={doc.emergency_phone} type="tel" onChange={(e) => set("emergency_phone", e.target.value)} /></Field>
          </div>
          <div style={{ marginTop: 8 }}>
            <SwitchRow title="Show phone on voucher" checked={doc.voucher_show_phone} onChange={(v) => set("voucher_show_phone", v)} />
            <SwitchRow title="Show email on voucher" checked={doc.voucher_show_email} onChange={(v) => set("voucher_show_email", v)} />
          </div>
        </>
      ),
    },
    {
      key: "rev", label: "Guest reviews", icon: "star", sub: "Scores come from verified Sky Holidays stays.",
      body: (
        <>
          <div className="row" style={{ gap: 20, alignItems: "flex-start" }}>
            <div style={{ textAlign: "center", width: 180 }}>
              <span className="score" style={{ fontSize: 24, height: 56, minWidth: 64, borderRadius: "16px 16px 16px 4px" }}>{doc.rating != null ? doc.rating.toFixed(1) : "–"}</span>
              <div className="t2" style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>{doc.rating != null ? scoreWord(doc.rating) : "No score"} · {fmt(doc.review_count ?? 0)} reviews</div>
              <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "nowrap" }}>
                <Num value={doc.rating} min={0} max={10} step="0.1" aria-label="Overall score" placeholder="Score" onChange={(v) => set("rating", v)} />
                <Num value={doc.review_count} min={0} aria-label="Review count" placeholder="Count" onChange={(v) => set("review_count", v)} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 220, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: "10px 20px" }}>
              {SCORE_KEYS.map((k) => {
                const v = doc.review_scores[k];
                return (
                  <div key={k}>
                    <div className="row" style={{ justifyContent: "space-between", fontSize: 12.5, flexWrap: "nowrap" }}>
                      <span>{SCORE_LABEL[k]}</span>
                      <input className="cat-score" type="number" min={0} max={10} step="0.1" value={v ?? ""} aria-label={`${SCORE_LABEL[k]} score`} onChange={(e) => set("review_scores", { ...doc.review_scores, [k]: e.target.value === "" ? undefined : Number(e.target.value) })} />
                    </div>
                    <div className="meter" style={{ marginTop: 5 }}><i style={{ width: `${(v ?? 0) * 10}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="list" style={{ marginTop: 14 }}>
            {doc.reviews.map((v, i) => openRev === i ? (
              <div key={v.id ?? `n${i}`} className="li" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                <div className="f-grid c4 grow">
                  <Field label="Guest"><Input value={v.guest_name} onChange={(e) => setRev(i, { guest_name: e.target.value })} /></Field>
                  <Field label="From"><Input value={v.guest_city} onChange={(e) => setRev(i, { guest_city: e.target.value })} placeholder="Lahore" /></Field>
                  <Field label="Score"><Num value={v.score} min={1} max={10} step="0.1" onChange={(x) => setRev(i, { score: x ?? 1 })} /></Field>
                  <Field label="Stayed"><Input type="date" value={v.stayed_on ?? ""} onChange={(e) => setRev(i, { stayed_on: e.target.value || null })} /></Field>
                  <Field label="Title" className="span-all"><Input value={v.title} onChange={(e) => setRev(i, { title: e.target.value })} /></Field>
                  <Field label="Review" className="span-all"><Textarea rows={2} value={v.body} onChange={(e) => setRev(i, { body: e.target.value })} /></Field>
                </div>
                <div className="row" style={{ gap: 8, flexDirection: "column", alignItems: "flex-end" }}>
                  <Btn size="sm" icon="check" onClick={() => setOpenRev(null)}>Done</Btn>
                  <Switch checked={v.is_published} onChange={(x) => setRev(i, { is_published: x })} label="Show this review" />
                  <IconBtn icon="trash" label="Delete review" onClick={() => { setOpenRev(null); set("reviews", doc.reviews.filter((_, j) => j !== i)); }} />
                </div>
              </div>
            ) : (
              <div key={v.id ?? `n${i}`} className="li" style={{ alignItems: "flex-start" }}>
                <span className="score">{v.score.toFixed(1)}</span>
                <div className="grow">
                  <b style={{ fontSize: 13.5 }}>{v.title || "Untitled review"}</b>
                  <div className="t2">{[v.guest_name, v.guest_city, v.stayed_on ? `stayed ${date(v.stayed_on)}` : null].filter(Boolean).join(" · ")}</div>
                  {v.body && <div style={{ fontSize: 13, marginTop: 4 }} className="muted">{v.body}</div>}
                </div>
                <Pill tone={v.is_published ? "good" : "plain"} dot={false}>{v.is_published ? "Shown" : "Hidden"}</Pill>
                <Switch checked={v.is_published} onChange={(x) => setRev(i, { is_published: x })} label={`Show review by ${v.guest_name}`} />
                <IconBtn icon="edit" label="Edit review" onClick={() => setOpenRev(i)} />
              </div>
            ))}
          </div>
          <Btn size="sm" icon="plus" style={{ marginTop: 10 }} onClick={() => { set("reviews", [{ guest_name: "", guest_city: "", score: 9, title: "", body: "", stayed_on: null, is_published: false }, ...doc.reviews]); setOpenRev(0); }}>Add a review</Btn>
        </>
      ),
    },
    {
      key: "vis", label: "Visibility & SEO", icon: "globe", sub: "Where the hotel appears and how search engines read it.", warn: warn("vis"),
      body: (
        <>
          <div className="f-grid">
            <Field label="Status"><Select value={doc.status} onChange={(e) => set("status", e.target.value as HotelDoc["status"])} options={[{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived (hidden)" }]} /></Field>
            <Field label="Sort priority" hint="Higher shows first in lists">
              <Select value={String(doc.priority)} onChange={(e) => set("priority", Number(e.target.value))} options={PRIORITIES.some((p) => p.value === String(doc.priority)) ? PRIORITIES : [{ value: String(doc.priority), label: `Custom (${doc.priority})` }, ...PRIORITIES]} />
            </Field>
            <Field label="Page address" className="span-all" hint={doc.slug ? undefined : "Made from the name when you save"}>
              <PreInput pre="skyholidays.pk/hotels/" value={doc.slug} placeholder={slugify(doc.name)} onChange={(e) => set("slug", slugify(e.target.value))} />
            </Field>
            <Field label="SEO title" className="span-all" hint={`${doc.seo_title.length} of 60 characters`}>
              <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
                <Input value={doc.seo_title} maxLength={70} onChange={(e) => set("seo_title", e.target.value)} />
                {!doc.seo_title && doc.name && <Btn size="sm" variant="ghost" onClick={() => set("seo_title", `${doc.name}${doc.city ? `, ${doc.city}` : ""} | Book with Sky Holidays`.slice(0, 70))}>Suggest</Btn>}
              </div>
            </Field>
            <Field label="Meta description" className="span-all" hint={`${doc.seo_description.length} of 160 characters`}><Textarea rows={2} value={doc.seo_description} onChange={(e) => set("seo_description", e.target.value)} /></Field>
            <Field label="Supplier"><Select value={doc.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="None" options={SUPPLIERS.includes(doc.supplier) || !doc.supplier ? SUPPLIERS : [doc.supplier, ...SUPPLIERS]} /></Field>
            <Field label="Supplier hotel ID" hint="Used to match this hotel in other systems"><Input value={doc.supplier_hotel_id} onChange={(e) => set("supplier_hotel_id", e.target.value)} /></Field>
          </div>
          <div style={{ marginTop: 8 }}>
            <SwitchRow title="Show on homepage" checked={doc.is_featured} onChange={(v) => set("is_featured", v)} />
            <SwitchRow title="Show in Weekly deals" checked={doc.in_deals} onChange={(v) => set("in_deals", v)} />
            <SwitchRow title="Allow pay at hotel" checked={doc.pay_at_hotel} onChange={(v) => set("pay_at_hotel", v)} />
          </div>
        </>
      ),
    },
  ];

  const cover = doc.photos[0]?.day ?? doc.voucher_image_url;
  const place = [doc.area, dest?.name ?? doc.city].filter(Boolean).join(", ");
  const side = (
    <>
      <div className="prev-card">
        <div className="prev-img" style={cover ? { backgroundImage: `url("${cover}")` } : { display: "grid", placeItems: "center", color: "var(--faint)" }}>
          {doc.badge && <span className="pill nodot">{doc.badge}</span>}
          {!cover && <Icon name="image" />}
        </div>
        <div className="prev-b">
          <h4>{doc.name || "New hotel"}</h4>
          <div style={{ color: "var(--muted)", fontSize: 12, margin: "2px 0 10px" }}>{place || "No location yet"}{doc.star_rating ? ` · ${"★".repeat(doc.star_rating)}` : ""}</div>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
            <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
              {doc.rating != null && <span className="score">{doc.rating.toFixed(1)}</span>}
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{fmt(doc.review_count ?? 0)} reviews</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <b style={{ fontSize: 19, color: "var(--gold)" }} className="tab">{price != null ? `${cur} ${fmt(price)}` : "–"}</b>
              <div style={{ fontSize: 11, color: "var(--faint)" }}>per night</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--faint)", textAlign: "center" }}>Live preview of the website card</div>
      <QualityPanel checks={checks} />
      {ed.meta && (
        <div className="panel" style={{ padding: 16 }}>
          <h3 style={{ margin: "0 0 8px" }}>This month</h3>
          <KV items={[["Bookings", fmt(ed.meta.stats.bookings)], ["Room nights", fmt(ed.meta.stats.nights)], ["Revenue", pkr(ed.meta.stats.revenue)], ["Rate plans live", fmt(doc.rate_plans.filter((p) => p.is_live).length)]]} />
        </div>
      )}
    </>
  );

  const savedStatus = ed.meta ? doc.status : "draft";
  return (
    <EditorFrame
      kind="hotels"
      eyebrow={ed.isNew ? "New hotel" : `Edit hotel${dest ? ` · ${dest.name}` : ""}`}
      title={doc.name || "New hotel"}
      pills={<>
        <Pill tone={statusTone(doc.status)} dot={doc.status !== "draft"}>{statusLabel(doc.status)}</Pill>
        {ed.meta && <Pill dot={false}>Saved {ago(ed.meta.updated_at).toLowerCase()}{ed.meta.updated_by ? ` by ${ed.meta.updated_by.split(" ")[0]}` : ""}</Pill>}
        <Pill tone="gold" dot={false}>Listing {pct}% complete</Pill>
        {ed.dirty && <Pill tone="warn">Unsaved changes</Pill>}
      </>}
      actions={<>
        {doc.slug && savedStatus === "published" && !ed.isNew && <a className="btn" href={siteUrl(`/hotels/${doc.slug}`)} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Icon name="eye" />Preview on site</a>}
        {canEdit && doc.status !== "published" && <Btn busy={ed.busy} onClick={() => ed.save()}>{ed.isNew ? "Save draft" : "Save draft"}</Btn>}
        {canEdit && <Btn variant="gold" icon="check" busy={ed.busy} onClick={() => ed.save({ status: "published" })}>{doc.status === "published" ? "Publish changes" : "Publish"}</Btn>}
      </>}
      sections={sections}
      side={side}
      dirty={canEdit && ed.dirty}
      busy={ed.busy}
      onSave={() => ed.save()}
      onReset={ed.reset}
    />
  );
}


