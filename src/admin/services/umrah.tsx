"use client";
// Umrah: flexible any-date packages (with rules and a live price example), group departures, and
// Makkah & Madinah hotel rates.
import { useEffect, useMemo, useState } from "react";
import { api, useData } from "../api";
import { date, fmt, money, slugify } from "../format";
import { useCan } from "../shell";
import {
  Btn, Check, Drawer, Empty, ErrorNote, Field, IconBtn, ImageUpload, Input, KV, Loading, PageHead, Panel, Pill, Select, SwitchRow, Textarea, type Tone,
} from "../ui";
import { cellPrice, isoInDays, LiveSwitch, NumInput, numStr, rowProps, Seats, SubHead, toNum, useAction, useDelete, useForm } from "./common";

/* ---------------- shared types ---------------- */

type Rate = { id?: string; season: string; starts_on: string | null; ends_on: string | null; quad: number | null; triple: number | null; double: number | null; single: number | null };
type UHotel = {
  hotel_id: string; city: "makkah" | "madinah"; distance_m: number | null; distance_label: string | null; is_live: boolean; sort_order: number;
  name: string; star_rating: number | null; hotel_status: string; rates: Rate[]; packages: number;
};
type Flex = {
  id: string; slug: string; title: string; kind: "flexible" | "visa_transport" | "ramadan"; tier: string | null; hotels_note: string | null; summary: string | null;
  image_day_url: string | null; image_night_url: string | null; min_total_nights: number; min_makkah_nights: number; min_madinah_nights: number; lead_days: number;
  ramadan_uplift_pct: number; flights: "quoted" | "own" | "either"; visa_included: boolean; transport_included: boolean; ziyarat_optional: boolean; madinah_first: boolean;
  visa_price: number; transport_price: number; transport_label: string | null; ziyarat_price: number; service_fee: number; price_from: number | null;
  currency_code: string; is_live: boolean; sort_order: number; hotel_ids: string[];
};

const CITY: Record<string, [string, Tone]> = { makkah: ["Makkah", "gold"], madinah: ["Madinah", "info"] };
const KIND = [{ value: "flexible", label: "Any date, hotels chosen by guest" }, { value: "ramadan", label: "Ramadan, any date" }, { value: "visa_transport", label: "Visa & transport only" }];
const TIER = [{ value: "economy", label: "Economy" }, { value: "standard", label: "Standard" }, { value: "premium", label: "Premium" }];
const FLIGHTS = [{ value: "quoted", label: "Quoted at booking" }, { value: "own", label: "Guest’s own ticket" }, { value: "either", label: "Either" }];
const baseRate = (h: UHotel) => h.rates.find((r) => !r.starts_on) ?? h.rates[0];
const stars = (n: number | null) => (n ? `${n}★` : "–");

function Head({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return <PageHead eyebrow="Umrah" title={title} sub={sub}>{children}</PageHead>;
}

/* ================= flexible packages ================= */

export function FlexibleTab({ label }: { label: string }) {
  const { data, error, loading, reload, setData } = useData<Flex[]>("/umrah/flexible");
  const hotels = useData<UHotel[]>("/umrah/hotels");
  const canCreate = useCan("umrah.flexible", "create");
  const canEdit = useCan("umrah.flexible", "edit");
  const [open, setOpen] = useState<string | null>(null);
  const [sel, setSel] = useState<string>("");
  const rows = data ?? [];
  const current = rows.find((r) => r.id === sel) ?? rows.find((r) => r.kind !== "visa_transport") ?? rows[0];

  return (
    <>
      <Head title={label} sub="No fixed dates. Guests choose their travel date, nights in Makkah and Madinah, room sharing and hotels. The price is worked out from your hotel rates and add-ons.">
        {canCreate && <Btn variant="gold" icon="plus" onClick={() => setOpen("new")}>Add flexible package</Btn>}
      </Head>
      <ErrorNote error={error} />
      {loading && !data ? <Loading /> : (
        <Panel className="svc-mb">
          {!rows.length ? <Empty icon="moon" title="No flexible packages yet" /> : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Package</th><th>Hotels</th><th>Minimum stay</th><th>Split</th><th className="num">From, per person (quad)</th><th>Live</th><th /></tr></thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} {...rowProps(() => setOpen(p.id))}>
                      <td><b>{p.title}</b><div className="t2">Any date{p.tier ? ` · ${TIER.find((t) => t.value === p.tier)?.label}` : ""}{p.kind === "ramadan" ? ` · +${fmt(p.ramadan_uplift_pct)}% Ramadan` : ""}</div></td>
                      <td>{p.hotels_note ?? "–"}{p.kind !== "visa_transport" && <div className="t2">{p.hotel_ids.length} hotels to choose from</div>}</td>
                      <td>{p.kind === "visa_transport" || !p.min_total_nights ? "Any" : `${p.min_total_nights} nights`}</td>
                      <td>{p.kind === "visa_transport" ? "No minimum" : `Makkah ${p.min_makkah_nights}+ · Madinah ${p.min_madinah_nights}+`}</td>
                      <td className="num tab"><b>{money(p.price_from, p.currency_code)}</b></td>
                      <td><LiveSwitch on={p.is_live} label={p.title} path={`/umrah/flexible/${p.id}`} field="is_live" disabled={!canEdit} onDone={(v) => setData((d) => d && d.map((x) => (x.id === p.id ? { ...x, is_live: v } : x)))} /></td>
                      <td><IconBtn icon="edit" label={`Edit ${p.title}`} onClick={(e) => { e.stopPropagation(); setOpen(p.id); }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      {current && (
        <div className="grid g-2" style={{ alignItems: "start" }}>
          <RulesPanel key={current.id + current.lead_days + current.min_total_nights} pkg={current} all={rows} onPick={setSel} canEdit={canEdit} onSaved={(p) => setData((d) => d && d.map((x) => (x.id === p.id ? { ...x, ...p } : x)))} />
          <PriceExample key={"ex" + current.id} pkg={current} hotels={hotels.data ?? []} />
        </div>
      )}
      <Drawer open={!!open} onClose={() => setOpen(null)} label="Flexible package" head={<h2 style={{ fontSize: 24 }}>{open === "new" ? "New flexible package" : rows.find((r) => r.id === open)?.title}</h2>}>
        {open && <FlexForm key={open} pkg={rows.find((r) => r.id === open) ?? null} hotels={hotels.data ?? []} onClose={() => setOpen(null)} onSaved={reload} />}
      </Drawer>
    </>
  );
}

type RuleForm = {
  min_total_nights: string; min_makkah_nights: string; min_madinah_nights: string; lead_days: string; ramadan_uplift_pct: string; flights: string;
  visa_included: boolean; transport_included: boolean; ziyarat_optional: boolean; madinah_first: boolean;
};
const toRules = (p: Flex): RuleForm => ({
  min_total_nights: String(p.min_total_nights), min_makkah_nights: String(p.min_makkah_nights), min_madinah_nights: String(p.min_madinah_nights),
  lead_days: String(p.lead_days), ramadan_uplift_pct: String(p.ramadan_uplift_pct), flights: p.flights, visa_included: p.visa_included,
  transport_included: p.transport_included, ziyarat_optional: p.ziyarat_optional, madinah_first: p.madinah_first,
});
const nightOpts = (a: number[]) => a.map((n) => ({ value: String(n), label: String(n) }));
const withCur = (opts: { value: string; label: string }[], v: string, fmtL: (v: string) => string = (x) => x) => (opts.some((o) => o.value === v) ? opts : [...opts, { value: v, label: fmtL(v) }]);

function RulesPanel({ pkg, all, onPick, canEdit, onSaved }: { pkg: Flex; all: Flex[]; onPick: (id: string) => void; canEdit: boolean; onSaved: (p: Flex) => void }) {
  const { f, set } = useForm<RuleForm>(toRules(pkg));
  const { busy, run } = useAction();
  const dirty = JSON.stringify(f) !== JSON.stringify(toRules(pkg));
  async function save() {
    const body = { ...f, min_total_nights: toNum(f.min_total_nights), min_makkah_nights: toNum(f.min_makkah_nights), min_madinah_nights: toNum(f.min_madinah_nights), lead_days: toNum(f.lead_days), ramadan_uplift_pct: toNum(f.ramadan_uplift_pct) ?? 0 };
    const out = await run(() => api.patch<Flex>(`/umrah/flexible/${pkg.id}`, body), "Rules saved");
    if (out) onSaved({ ...pkg, ...out, hotel_ids: pkg.hotel_ids });
  }
  return (
    <Panel title="Rules for flexible packages" actions={canEdit && dirty ? <Btn size="sm" variant="gold" icon="check" busy={busy} onClick={save}>Save rules</Btn> : undefined}>
      <div className="f-grid">
        <Field label="Package" className="span-all"><Select value={pkg.id} onChange={(e) => onPick(e.target.value)} options={all.map((p) => ({ value: p.id, label: p.title }))} /></Field>
        <Field label="Minimum total nights"><Select value={f.min_total_nights} onChange={(e) => set("min_total_nights")(e.target.value)} options={withCur(nightOpts([0, 5, 7, 10, 14, 15, 21]), f.min_total_nights)} /></Field>
        <Field label="Minimum nights in Makkah"><Select value={f.min_makkah_nights} onChange={(e) => set("min_makkah_nights")(e.target.value)} options={withCur(nightOpts([0, 2, 3, 4, 5, 6, 8]), f.min_makkah_nights)} /></Field>
        <Field label="Minimum nights in Madinah"><Select value={f.min_madinah_nights} onChange={(e) => set("min_madinah_nights")(e.target.value)} options={withCur(nightOpts([0, 2, 3, 4, 5]), f.min_madinah_nights)} /></Field>
        <Field label="Book at least"><Select value={f.lead_days} onChange={(e) => set("lead_days")(e.target.value)} options={withCur([3, 7, 14, 21, 30].map((n) => ({ value: String(n), label: `${n} days before travel` })), f.lead_days, (v) => `${v} days before travel`)} /></Field>
        <Field label="Ramadan last ten nights" hint="Added to hotel rates"><NumInput value={f.ramadan_uplift_pct} onChange={set("ramadan_uplift_pct")} pre="+%" /></Field>
        <Field label="Flights"><Select value={f.flights} onChange={(e) => set("flights")(e.target.value)} options={FLIGHTS} /></Field>
      </div>
      <div style={{ marginTop: 8 }}>
        <SwitchRow title="Umrah visa included" checked={f.visa_included} onChange={set("visa_included")} disabled={!canEdit} />
        <SwitchRow title="Airport and intercity transport included" checked={f.transport_included} onChange={set("transport_included")} disabled={!canEdit} />
        <SwitchRow title="Ziyarat as optional add-on" checked={f.ziyarat_optional} onChange={set("ziyarat_optional")} disabled={!canEdit} />
        <SwitchRow title="Allow Madinah first" checked={f.madinah_first} onChange={set("madinah_first")} disabled={!canEdit} />
      </div>
    </Panel>
  );
}

type QuoteRes = { lines: { label: string; amount: number }[]; perPerson: number; total: number; currency: string; warnings: string[] };

function PriceExample({ pkg, hotels }: { pkg: Flex; hotels: UHotel[] }) {
  const choice = (city: string) => hotels.filter((h) => h.city === city && h.is_live && (!pkg.hotel_ids.length || pkg.hotel_ids.includes(h.hotel_id)));
  const mk = choice("makkah"), md = choice("madinah");
  const mkN = Math.max(pkg.min_makkah_nights, pkg.min_total_nights - pkg.min_madinah_nights);
  const [q, setQ] = useState({
    date: isoInDays(pkg.lead_days + 60), guests: "4", sharing: "quad", makkah_hotel_id: "", makkah_nights: String(mkN || 0),
    madinah_hotel_id: "", madinah_nights: String(Math.max(pkg.min_madinah_nights, pkg.min_total_nights - mkN) || 0), ziyarat: false, ramadan: pkg.kind === "ramadan", madinah_first: false,
  });
  const mkId = q.makkah_hotel_id || mk[0]?.hotel_id || "";
  const mdId = q.madinah_hotel_id || md[0]?.hotel_id || "";
  const [res, setRes] = useState<QuoteRes | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const vt = pkg.kind === "visa_transport";
  const payload = JSON.stringify({
    package_id: pkg.id, date: q.date || null, sharing: q.sharing, guests: Number(q.guests) || 1, ziyarat: q.ziyarat, ramadan: q.ramadan, madinah_first: q.madinah_first,
    makkah_hotel_id: vt ? null : mkId || null, makkah_nights: vt ? 0 : Number(q.makkah_nights) || 0, madinah_hotel_id: vt ? null : mdId || null, madinah_nights: vt ? 0 : Number(q.madinah_nights) || 0,
  });
  useEffect(() => {
    const t = setTimeout(() => {
      api.post<QuoteRes>("/umrah/quote", JSON.parse(payload)).then((r) => { setRes(r); setErr(null); }).catch((e) => setErr((e as Error).message));
    }, 250);
    return () => clearTimeout(t);
  }, [payload]);
  const up = (p: Partial<typeof q>) => setQ((x) => ({ ...x, ...p }));
  const hName = (id: string) => hotels.find((h) => h.hotel_id === id)?.name ?? "–";
  return (
    <Panel title="Price example" label="What a guest sees">
      <div className="f-grid" style={{ marginBottom: 14 }}>
        <Field label="Travel date"><Input type="date" value={q.date} onChange={(e) => up({ date: e.target.value })} /></Field>
        <Field label="Guests and sharing">
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <NumInput aria-label="Guests" value={q.guests} onChange={(v) => up({ guests: v })} min={1} />
            <Select aria-label="Room sharing" value={q.sharing} onChange={(e) => up({ sharing: e.target.value })} options={["quad", "triple", "double", "single"].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))} />
          </div>
        </Field>
        {!vt && <>
          <Field label="Makkah hotel"><Select value={mkId} onChange={(e) => up({ makkah_hotel_id: e.target.value })} options={mk.map((h) => ({ value: h.hotel_id, label: `${h.name} · ${stars(h.star_rating)}` }))} placeholder={mk.length ? undefined : "No Makkah hotels"} /></Field>
          <Field label="Nights in Makkah"><NumInput value={q.makkah_nights} onChange={(v) => up({ makkah_nights: v })} /></Field>
          <Field label="Madinah hotel"><Select value={mdId} onChange={(e) => up({ madinah_hotel_id: e.target.value })} options={md.map((h) => ({ value: h.hotel_id, label: `${h.name} · ${stars(h.star_rating)}` }))} placeholder={md.length ? undefined : "No Madinah hotels"} /></Field>
          <Field label="Nights in Madinah"><NumInput value={q.madinah_nights} onChange={(v) => up({ madinah_nights: v })} /></Field>
        </>}
      </div>
      <div className="row" style={{ marginBottom: 12, gap: 16 }}>
        {pkg.ziyarat_optional && <Check label="Add Ziyarat" checked={q.ziyarat} onChange={(v) => up({ ziyarat: v })} />}
        {!vt && pkg.kind !== "ramadan" && <Check label="Last ten nights of Ramadan" checked={q.ramadan} onChange={(v) => up({ ramadan: v })} />}
        {!vt && pkg.madinah_first && <Check label="Madinah first" checked={q.madinah_first} onChange={(v) => up({ madinah_first: v })} />}
      </div>
      <KV items={[
        ["Travel", q.date ? date(q.date) : "Any date"],
        ["Guests", `${q.guests} ${Number(q.guests) === 1 ? "adult" : "adults"}, ${q.sharing}`],
        ...(!vt ? [["Makkah", `${hName(mkId)} · ${q.makkah_nights} nights`], ["Madinah", `${hName(mdId)} · ${q.madinah_nights} nights`]] as [string, string][] : []),
      ]} />
      <ErrorNote error={err} />
      {res && (
        <>
          {!!res.warnings.length && <div className="err svc-warn" style={{ marginTop: 12 }}>{res.warnings.map((w) => <span key={w}>{w}</span>)}</div>}
          <div className="ledger" style={{ marginTop: 14 }}>
            {res.lines.map((l, i) => <div className="ln" key={i}><span>{l.label}</span><span className="tab">{money(l.amount, res.currency)}</span></div>)}
            <div className="ln tot"><span>Per person{pkg.flights !== "own" ? ", without flights" : ""}</span><span className="tab">{money(res.perPerson, res.currency)}</span></div>
            {Number(q.guests) > 1 && <div className="ln"><span>For {q.guests} guests</span><span className="tab">{money(res.total, res.currency)}</span></div>}
          </div>
        </>
      )}
    </Panel>
  );
}

type FlexForm = Omit<RuleForm, never> & {
  title: string; slug: string; kind: string; tier: string; hotels_note: string; summary: string; image_day_url: string | null; image_night_url: string | null;
  visa_price: string; transport_price: string; transport_label: string; ziyarat_price: string; service_fee: string; is_live: boolean; sort_order: string; hotel_ids: string[];
};
const NEW_FLEX: FlexForm = {
  title: "", slug: "", kind: "flexible", tier: "standard", hotels_note: "", summary: "", image_day_url: null, image_night_url: null,
  min_total_nights: "10", min_makkah_nights: "5", min_madinah_nights: "4", lead_days: "14", ramadan_uplift_pct: "35", flights: "either",
  visa_included: true, transport_included: true, ziyarat_optional: true, madinah_first: true,
  visa_price: "72000", transport_price: "21000", transport_label: "GMC shared", ziyarat_price: "6000", service_fee: "12000", is_live: true, sort_order: "0", hotel_ids: [],
};

function FlexForm({ pkg, hotels, onClose, onSaved }: { pkg: Flex | null; hotels: UHotel[]; onClose: () => void; onSaved: () => void }) {
  const { f, setF, set } = useForm<FlexForm>(pkg ? {
    ...toRules(pkg), title: pkg.title, slug: pkg.slug, kind: pkg.kind, tier: pkg.tier ?? "", hotels_note: pkg.hotels_note ?? "", summary: pkg.summary ?? "",
    image_day_url: pkg.image_day_url, image_night_url: pkg.image_night_url, visa_price: numStr(pkg.visa_price), transport_price: numStr(pkg.transport_price),
    transport_label: pkg.transport_label ?? "", ziyarat_price: numStr(pkg.ziyarat_price), service_fee: numStr(pkg.service_fee), is_live: pkg.is_live,
    sort_order: String(pkg.sort_order), hotel_ids: pkg.hotel_ids,
  } : NEW_FLEX);
  const canSave = useCan("umrah.flexible", pkg ? "edit" : "create");
  const canDelete = useCan("umrah.flexible", "delete");
  const { busy, run } = useAction();
  const del = useDelete();
  const vt = f.kind === "visa_transport";
  async function save() {
    const n = (v: string) => toNum(v) ?? 0;
    const body = {
      ...f, tier: f.tier || null, min_total_nights: n(f.min_total_nights), min_makkah_nights: n(f.min_makkah_nights), min_madinah_nights: n(f.min_madinah_nights),
      lead_days: n(f.lead_days), ramadan_uplift_pct: n(f.ramadan_uplift_pct), visa_price: n(f.visa_price), transport_price: n(f.transport_price),
      ziyarat_price: n(f.ziyarat_price), service_fee: n(f.service_fee), sort_order: n(f.sort_order), hotel_ids: vt ? [] : f.hotel_ids,
    };
    const out = await run(() => (pkg ? api.put(`/umrah/flexible/${pkg.id}`, body) : api.post("/umrah/flexible", body)), pkg ? "Package saved" : "Package added");
    if (out) { onSaved(); onClose(); }
  }
  const toggleHotel = (id: string, on: boolean) => setF((x) => ({ ...x, hotel_ids: on ? [...x.hotel_ids, id] : x.hotel_ids.filter((h) => h !== id) }));
  return (
    <>
      <div className="f-grid">
        <Field label="Name" className="span-all"><Input value={f.title} onChange={(e) => { const v = e.target.value; setF((x) => ({ ...x, title: v, slug: pkg ? x.slug : slugify(v) })); }} /></Field>
        <Field label="Web address"><Input value={f.slug} onChange={(e) => set("slug")(slugify(e.target.value))} /></Field>
        <Field label="Kind"><Select value={f.kind} onChange={(e) => set("kind")(e.target.value)} options={KIND} /></Field>
        <Field label="Tier"><Select value={f.tier} onChange={(e) => set("tier")(e.target.value)} options={TIER} placeholder="No tier" /></Field>
        <Field label="Hotels, in short" hint="e.g. 4★, 3 minutes or less"><Input value={f.hotels_note} onChange={(e) => set("hotels_note")(e.target.value)} /></Field>
        <Field label="Summary" className="span-all"><Textarea rows={2} value={f.summary} onChange={(e) => set("summary")(e.target.value)} /></Field>
      </div>
      <div className="grid g-2">
        <Field label="Day photo"><ImageUpload value={f.image_day_url} onChange={set("image_day_url")} folder="packages" aspect="16/9" /></Field>
        <Field label="Evening photo"><ImageUpload value={f.image_night_url} onChange={set("image_night_url")} folder="packages" aspect="16/9" /></Field>
      </div>

      {!vt && (
        <Panel className="svc-inner">
          <SubHead>Hotels guests can choose</SubHead>
          {!hotels.length && <p className="muted" style={{ margin: 0 }}>Add hotels under Makkah &amp; Madinah hotels first.</p>}
          {(["makkah", "madinah"] as const).map((c) => (
            <div key={c}>
              <div className="t2" style={{ fontWeight: 700, marginBottom: 6 }}>{CITY[c][0]}</div>
              <div className="svc-chk">
                {hotels.filter((h) => h.city === c).map((h) => (
                  <Check key={h.hotel_id} checked={f.hotel_ids.includes(h.hotel_id)} onChange={(v) => toggleHotel(h.hotel_id, v)}
                    label={<span>{h.name} <span className="muted">· {stars(h.star_rating)} · quad {cellPrice(baseRate(h)?.quad)}</span></span>} />
                ))}
              </div>
            </div>
          ))}
        </Panel>
      )}

      <Panel className="svc-inner">
        <SubHead>Rules</SubHead>
        <div className="f-grid">
          {!vt && <>
            <Field label="Minimum total nights"><NumInput value={f.min_total_nights} onChange={set("min_total_nights")} /></Field>
            <Field label="Minimum nights in Makkah"><NumInput value={f.min_makkah_nights} onChange={set("min_makkah_nights")} /></Field>
            <Field label="Minimum nights in Madinah"><NumInput value={f.min_madinah_nights} onChange={set("min_madinah_nights")} /></Field>
          </>}
          <Field label="Book at least" hint="Days before travel"><NumInput value={f.lead_days} onChange={set("lead_days")} pre="days" /></Field>
          {!vt && <Field label="Ramadan last ten nights" hint={f.kind === "ramadan" ? "Always applied to this package" : "Added to hotel rates"}><NumInput value={f.ramadan_uplift_pct} onChange={set("ramadan_uplift_pct")} pre="+%" /></Field>}
          <Field label="Flights"><Select value={f.flights} onChange={(e) => set("flights")(e.target.value)} options={FLIGHTS} /></Field>
        </div>
        <div>
          {!vt && <SwitchRow title="Umrah visa included" checked={f.visa_included} onChange={set("visa_included")} />}
          {!vt && <SwitchRow title="Airport and intercity transport included" checked={f.transport_included} onChange={set("transport_included")} />}
          <SwitchRow title="Ziyarat as optional add-on" checked={f.ziyarat_optional} onChange={set("ziyarat_optional")} />
          {!vt && <SwitchRow title="Allow Madinah first" checked={f.madinah_first} onChange={set("madinah_first")} />}
        </div>
      </Panel>

      <Panel className="svc-inner">
        <SubHead>Add-ons, per person</SubHead>
        <div className="f-grid">
          <Field label="Umrah visa"><NumInput value={f.visa_price} onChange={set("visa_price")} pre="PKR" /></Field>
          <Field label="Transport"><NumInput value={f.transport_price} onChange={set("transport_price")} pre="PKR" /></Field>
          <Field label="Transport, shown as" hint="e.g. GMC shared"><Input value={f.transport_label} onChange={(e) => set("transport_label")(e.target.value)} /></Field>
          <Field label="Ziyarat"><NumInput value={f.ziyarat_price} onChange={set("ziyarat_price")} pre="PKR" /></Field>
          <Field label="Service fee"><NumInput value={f.service_fee} onChange={set("service_fee")} pre="PKR" /></Field>
          <Field label="Order in list"><NumInput value={f.sort_order} onChange={set("sort_order")} /></Field>
        </div>
        <p className="muted" style={{ margin: 0 }}>The “from” price is worked out when you save: cheapest chosen hotels, quad sharing, minimum stay, plus the add-ons that are included.</p>
      </Panel>
      <SwitchRow title="Live on the website" checked={f.is_live} onChange={set("is_live")} />
      <div className="row svc-foot">
        {canSave && <Btn variant="gold" icon="check" busy={busy} onClick={save}>{pkg ? "Save package" : "Add package"}</Btn>}
        <span style={{ flex: 1 }} />
        {pkg && canDelete && <Btn variant="danger" icon="trash" onClick={async () => { if (await del(`/umrah/flexible/${pkg.id}`, "this package")) { onSaved(); onClose(); } }}>Delete</Btn>}
      </div>
    </>
  );
}

/* ================= group departures ================= */

type Group = {
  id: string; package_id: string; package_title: string; depart_date: string; return_date: string | null; departure_city: string | null; airline: string | null;
  flight_no: string | null; route: string | null; seats_total: number; seats_sold: number; price_quad: number | null; price_triple: number | null; price_double: number | null;
  currency_code: string; group_leader: string | null; leader_phone: string | null; visa_status: string; visa_note: string | null; status: string; notes: string | null;
  bookings: number; passports_missing: number;
};
const VISA: Record<string, [string, Tone]> = {
  not_started: ["Not started", "plain"], filing_open: ["Filing open", "info"], passports_missing: ["Passports missing", "warn"], submitted: ["Submitted", "sig"], approved: ["Visas issued", "good"],
};
const GSTATUS = [{ value: "open", label: "Open for booking" }, { value: "full", label: "Full" }, { value: "closed", label: "Closed" }, { value: "departed", label: "Departed" }, { value: "cancelled", label: "Cancelled" }];

export function GroupsTab({ label }: { label: string }) {
  const [past, setPast] = useState(false);
  const { data, error, loading, reload } = useData<{ rows: Group[]; packages: { id: string; title: string; nights: number; price_from: number }[] }>(`/umrah/groups${past ? "?past=1" : ""}`);
  const canCreate = useCan("umrah.groups", "create");
  const [open, setOpen] = useState<string | null>(null);
  const [manifest, setManifest] = useState<string | null>(null);
  const rows = data?.rows ?? [];
  return (
    <>
      <Head title={label} sub="Fixed group dates with seats, flights, group leaders and visa progress.">
        <Btn variant="ghost" icon="clock" onClick={() => setPast((v) => !v)}>{past ? "Show upcoming" : "Show past"}</Btn>
        {canCreate && <Btn variant="gold" icon="plus" onClick={() => setOpen("new")}>Add departure</Btn>}
      </Head>
      <ErrorNote error={error} />
      {loading && !data ? <Loading /> : (
        <Panel>
          {!rows.length ? <Empty icon="plane" title={past ? "No past departures" : "No upcoming departures"}>Add a departure for an Umrah package.</Empty> : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Departure</th><th>Package</th><th>Flight</th><th>Group leader</th><th>Seats sold</th><th>Visas</th><th /></tr></thead>
                <tbody>
                  {rows.map((g) => {
                    const v = g.passports_missing ? ["passports_missing", `${g.passports_missing} passports missing`] : [g.visa_status, g.visa_note || VISA[g.visa_status]?.[0]];
                    return (
                      <tr key={g.id} {...rowProps(() => setOpen(g.id))}>
                        <td><b className="mono" style={{ color: "var(--gold)" }}>{date(g.depart_date)}</b><div className="t2">{g.return_date ? `Back ${date(g.return_date, false)}` : ""}{g.status !== "open" ? ` · ${GSTATUS.find((s) => s.value === g.status)?.label}` : ""}</div></td>
                        <td><b>{g.package_title}</b><div className="t2">{[g.departure_city && `From ${g.departure_city}`, g.price_quad && `Quad ${fmt(g.price_quad)}`].filter(Boolean).join(" · ")}</div></td>
                        <td className="mono">{[g.airline, g.flight_no].filter(Boolean).join(" ")}{g.route ? ` · ${g.route}` : ""}</td>
                        <td>{g.group_leader ?? "–"}{g.leader_phone && <div className="t2">{g.leader_phone}</div>}</td>
                        <td><div className="svc-seats"><Seats sold={g.seats_sold} total={g.seats_total} /></div></td>
                        <td><Pill tone={VISA[v[0]]?.[1]} dot={v[0] !== "not_started"}>{v[1]}</Pill></td>
                        <td><Btn size="sm" onClick={(e) => { e.stopPropagation(); setManifest(g.id); }}>Manifest</Btn></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      <Drawer open={!!open} onClose={() => setOpen(null)} label="Group departure" head={<h2 style={{ fontSize: 24 }}>{open === "new" ? "New group departure" : "Group departure"}</h2>}>
        {open && data && <GroupForm key={open} g={rows.find((r) => r.id === open) ?? null} packages={data.packages} onClose={() => setOpen(null)} onSaved={reload} />}
      </Drawer>
      <Drawer open={!!manifest} onClose={() => setManifest(null)} label="Manifest" head={<h2 style={{ fontSize: 24 }}>Manifest</h2>}>
        {manifest && <Manifest id={manifest} />}
      </Drawer>
    </>
  );
}

type GForm = Record<"package_id" | "depart_date" | "return_date" | "departure_city" | "airline" | "flight_no" | "route" | "seats_total" | "seats_sold" | "price_quad" | "price_triple" | "price_double" | "group_leader" | "leader_phone" | "visa_status" | "visa_note" | "status" | "notes", string>;

function GroupForm({ g, packages, onClose, onSaved }: { g: Group | null; packages: { id: string; title: string; price_from: number }[]; onClose: () => void; onSaved: () => void }) {
  const s = (v: string | number | null | undefined) => (v == null ? "" : String(v));
  const { f, set } = useForm<GForm>({
    package_id: s(g?.package_id ?? packages[0]?.id), depart_date: s(g?.depart_date), return_date: s(g?.return_date), departure_city: s(g?.departure_city ?? "Karachi"),
    airline: s(g?.airline), flight_no: s(g?.flight_no), route: s(g?.route), seats_total: s(g?.seats_total ?? 45), seats_sold: s(g?.seats_sold ?? 0),
    price_quad: s(g?.price_quad ?? packages[0]?.price_from), price_triple: s(g?.price_triple), price_double: s(g?.price_double), group_leader: s(g?.group_leader),
    leader_phone: s(g?.leader_phone), visa_status: s(g?.visa_status ?? "not_started"), visa_note: s(g?.visa_note), status: s(g?.status ?? "open"), notes: s(g?.notes),
  });
  const canSave = useCan("umrah.groups", g ? "edit" : "create");
  const canDelete = useCan("umrah.groups", "delete");
  const { busy, run } = useAction();
  const del = useDelete();
  async function save() {
    const body = {
      ...f, return_date: f.return_date || null, seats_total: toNum(f.seats_total) ?? 0, seats_sold: toNum(f.seats_sold) ?? 0,
      price_quad: toNum(f.price_quad), price_triple: toNum(f.price_triple), price_double: toNum(f.price_double),
    };
    const out = await run(() => (g ? api.put(`/umrah/groups/${g.id}`, body) : api.post("/umrah/groups", body)), g ? "Departure saved" : "Departure added");
    if (out) { onSaved(); onClose(); }
  }
  const sold = toNum(f.seats_sold) ?? 0, total = toNum(f.seats_total) ?? 0;
  return (
    <>
      {!packages.length && <div className="err">Add an Umrah package under Packages first.</div>}
      <div className="f-grid">
        <Field label="Package" className="span-all"><Select value={f.package_id} onChange={(e) => set("package_id")(e.target.value)} options={packages.map((p) => ({ value: p.id, label: p.title }))} /></Field>
        <Field label="Departs"><Input type="date" value={f.depart_date} onChange={(e) => set("depart_date")(e.target.value)} /></Field>
        <Field label="Returns"><Input type="date" value={f.return_date} onChange={(e) => set("return_date")(e.target.value)} /></Field>
        <Field label="Departure city"><Select value={f.departure_city} onChange={(e) => set("departure_city")(e.target.value)} options={withCur(["Karachi", "Lahore", "Islamabad", "Peshawar", "Multan", "Faisalabad", "Quetta", "Sialkot"].map((c) => ({ value: c, label: c })), f.departure_city)} /></Field>
        <Field label="Airline"><Input value={f.airline} placeholder="Saudia" onChange={(e) => set("airline")(e.target.value)} /></Field>
        <Field label="Flight number"><Input value={f.flight_no} placeholder="SV 701" onChange={(e) => set("flight_no")(e.target.value)} /></Field>
        <Field label="Route"><Input value={f.route} placeholder="KHI→JED" onChange={(e) => set("route")(e.target.value)} /></Field>
        <Field label="Seats in total"><NumInput value={f.seats_total} onChange={set("seats_total")} /></Field>
        <Field label="Seats booked"><NumInput value={f.seats_sold} onChange={set("seats_sold")} /></Field>
        {total > 0 && <div className="span-all"><Seats sold={sold} total={total} /></div>}
      </div>
      <Panel className="svc-inner">
        <SubHead>Price per person by room sharing</SubHead>
        <div className="f-grid c3">
          <Field label="Quad"><NumInput value={f.price_quad} onChange={set("price_quad")} pre="PKR" /></Field>
          <Field label="Triple"><NumInput value={f.price_triple} onChange={set("price_triple")} pre="PKR" /></Field>
          <Field label="Double"><NumInput value={f.price_double} onChange={set("price_double")} pre="PKR" /></Field>
        </div>
      </Panel>
      <div className="f-grid">
        <Field label="Group leader"><Input value={f.group_leader} onChange={(e) => set("group_leader")(e.target.value)} /></Field>
        <Field label="Leader’s phone"><Input value={f.leader_phone} onChange={(e) => set("leader_phone")(e.target.value)} /></Field>
        <Field label="Visas"><Select value={f.visa_status} onChange={(e) => set("visa_status")(e.target.value)} options={Object.entries(VISA).map(([value, [label]]) => ({ value, label }))} /></Field>
        <Field label="Visa note" hint="e.g. 6 passports missing"><Input value={f.visa_note} onChange={(e) => set("visa_note")(e.target.value)} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status")(e.target.value)} options={GSTATUS} /></Field>
        <Field label="Notes" className="span-all"><Textarea rows={2} value={f.notes} onChange={(e) => set("notes")(e.target.value)} /></Field>
      </div>
      <div className="row svc-foot">
        {canSave && <Btn variant="gold" icon="check" busy={busy} onClick={save}>{g ? "Save departure" : "Add departure"}</Btn>}
        <span style={{ flex: 1 }} />
        {g && canDelete && <Btn variant="danger" icon="trash" onClick={async () => { if (await del(`/umrah/groups/${g.id}`, "this departure")) { onSaved(); onClose(); } }}>Delete</Btn>}
      </div>
    </>
  );
}

type MRow = { booking_id: string; ref: string; status: string; lead_name: string; lead_phone: string | null; sharing: string | null; full_name: string | null; kind: string | null; passport_no: string | null; passport_expiry: string | null; passport_status: string | null };
function Manifest({ id }: { id: string }) {
  const { data, error, loading } = useData<{ group: Group; travellers: MRow[] }>(`/umrah/groups/${id}/manifest`);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} />;
  if (!data) return null;
  const g = data.group;
  const pp: Record<string, [string, Tone]> = { missing: ["Missing", "warn"], received: ["Received", "info"], verified: ["Verified", "good"] };
  return (
    <>
      <KV items={[["Package", g.package_title], ["Departs", date(g.depart_date)], ["Flight", [g.airline, g.flight_no, g.route].filter(Boolean).join(" ") || "–"], ["Group leader", g.group_leader ?? "–"], ["Seats", `${g.seats_sold} of ${g.seats_total}`], ["Bookings", fmt(g.bookings)]]} />
      {!data.travellers.length ? <Empty icon="users" title="No bookings on this departure yet">Bookings made for this date will list their travellers here.</Empty> : (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Traveller</th><th>Booking</th><th>Passport</th><th>Expiry</th><th>Status</th></tr></thead>
            <tbody>
              {data.travellers.map((t, i) => (
                <tr key={i}>
                  <td><b>{t.full_name ?? t.lead_name}</b><div className="t2">{t.kind ?? "adult"}{t.sharing ? ` · ${t.sharing}` : ""}</div></td>
                  <td className="mono">{t.ref}</td>
                  <td className="mono">{t.passport_no ?? "–"}</td>
                  <td>{date(t.passport_expiry)}</td>
                  <td>{t.passport_status ? <Pill tone={pp[t.passport_status]?.[1]}>{pp[t.passport_status]?.[0]}</Pill> : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="row"><Btn icon="file" onClick={() => print()}>Print</Btn></div>
    </>
  );
}

/* ================= Makkah & Madinah hotels ================= */

export function HotelsTab({ label }: { label: string }) {
  const { data, error, loading, reload, setData } = useData<UHotel[]>("/umrah/hotels");
  const canCreate = useCan("umrah.hotels", "create");
  const canEdit = useCan("umrah.hotels", "edit");
  const [open, setOpen] = useState<string | null>(null);
  const rows = data ?? [];
  return (
    <>
      <Head title={label} sub="Hotels guests can pick in flexible packages. Prices are per person per night, by room sharing.">
        {canCreate && <Btn variant="gold" icon="plus" onClick={() => setOpen("new")}>Add hotel</Btn>}
      </Head>
      <ErrorNote error={error} />
      {loading && !data ? <Loading /> : (
        <Panel>
          {!rows.length ? <Empty icon="bed" title="No Umrah hotels yet" /> : (
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>City</th><th>Hotel</th><th>Stars</th><th>Distance to Haram</th><th className="num">Quad</th><th className="num">Triple</th><th className="num">Double</th><th className="num">Single</th><th>Seasons</th><th>Live</th></tr></thead>
                <tbody>
                  {rows.map((h) => {
                    const b = baseRate(h);
                    const seasons = h.rates.filter((r) => r.starts_on).length;
                    return (
                      <tr key={h.hotel_id} {...rowProps(() => setOpen(h.hotel_id))}>
                        <td><Pill tone={CITY[h.city][1]}>{CITY[h.city][0]}</Pill></td>
                        <td><b>{h.name}</b>{h.hotel_status === "draft" && <div className="t2">Draft in Hotels</div>}</td>
                        <td>{stars(h.star_rating)}</td>
                        <td>{h.distance_label ?? (h.distance_m != null ? `${fmt(h.distance_m)} m` : "–")}</td>
                        {(["quad", "triple", "double", "single"] as const).map((k) => <td key={k} className="num tab">{cellPrice(b?.[k])}</td>)}
                        <td>{seasons ? `${seasons} ${seasons === 1 ? "season" : "seasons"}` : "Base only"}</td>
                        <td><LiveSwitch on={h.is_live} label={h.name} path={`/umrah/hotels/${h.hotel_id}`} field="is_live" disabled={!canEdit} onDone={(v) => setData((d) => d && d.map((x) => (x.hotel_id === h.hotel_id ? { ...x, is_live: v } : x)))} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
      <Drawer open={!!open} onClose={() => setOpen(null)} label="Umrah hotel" head={<h2 style={{ fontSize: 24 }}>{open === "new" ? "Add Umrah hotel" : rows.find((r) => r.hotel_id === open)?.name}</h2>}>
        {open && <HotelForm key={open} h={rows.find((r) => r.hotel_id === open) ?? null} onClose={() => setOpen(null)} onSaved={reload} />}
      </Drawer>
    </>
  );
}

type RForm = { season: string; starts_on: string; ends_on: string; quad: string; triple: string; double: string; single: string };
function HotelForm({ h, onClose, onSaved }: { h: UHotel | null; onClose: () => void; onSaved: () => void }) {
  const cands = useData<{ id: string; name: string; star_rating: number | null; city: string }[]>(h ? null : "/umrah/hotels/candidates");
  const [mode, setMode] = useState<"link" | "new">("new");
  const { f, setF, set } = useForm({
    hotel_id: "", name: h?.name ?? "", star_rating: String(h?.star_rating ?? 4), city: h?.city ?? "makkah", distance_m: numStr(h?.distance_m), distance_label: h?.distance_label ?? "",
    is_live: h?.is_live ?? true, sort_order: String(h?.sort_order ?? 0),
    rates: (h?.rates.length ? h.rates : [{ season: "Base rate", starts_on: null, ends_on: null, quad: null, triple: null, double: null, single: null }]).map((r): RForm => ({
      season: r.season, starts_on: r.starts_on ?? "", ends_on: r.ends_on ?? "", quad: numStr(r.quad), triple: numStr(r.triple), double: numStr(r.double), single: numStr(r.single),
    })),
  });
  useEffect(() => {
    // Offer linking when the catalogue already has hotels in Makkah or Madinah.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cands.data?.length) setMode("link");
  }, [cands.data]);
  const canSave = useCan("umrah.hotels", h ? "edit" : "create");
  const canDelete = useCan("umrah.hotels", "delete");
  const { busy, run } = useAction();
  const del = useDelete();
  const updR = (i: number, p: Partial<RForm>) => setF((x) => ({ ...x, rates: x.rates.map((r, j) => (j === i ? { ...r, ...p } : r)) }));
  const linked = useMemo(() => cands.data?.find((c) => c.id === f.hotel_id), [cands.data, f.hotel_id]);
  async function save() {
    const body = {
      hotel_id: !h && mode === "link" ? f.hotel_id || null : null, name: h || mode === "new" ? f.name : null, star_rating: toNum(f.star_rating),
      city: linked?.city ?? f.city, distance_m: toNum(f.distance_m), distance_label: f.distance_label || null, is_live: f.is_live, sort_order: toNum(f.sort_order) ?? 0,
      rates: f.rates.map((r) => ({ season: r.season || "Season", starts_on: r.starts_on || null, ends_on: r.ends_on || null, quad: toNum(r.quad), triple: toNum(r.triple), double: toNum(r.double), single: toNum(r.single) })),
    };
    const out = await run(() => (h ? api.put(`/umrah/hotels/${h.hotel_id}`, body) : api.post("/umrah/hotels", body)), h ? "Hotel saved" : "Hotel added");
    if (out) { onSaved(); onClose(); }
  }
  return (
    <>
      {!h && !!cands.data?.length && (
        <div className="row">
          <Btn size="sm" variant={mode === "link" ? "gold" : "plain"} onClick={() => setMode("link")}>Use a hotel from the catalogue</Btn>
          <Btn size="sm" variant={mode === "new" ? "gold" : "plain"} onClick={() => setMode("new")}>New hotel</Btn>
        </div>
      )}
      <div className="f-grid">
        {!h && mode === "link" ? (
          <Field label="Hotel" className="span-all"><Select value={f.hotel_id} placeholder="Choose a hotel" onChange={(e) => set("hotel_id")(e.target.value)} options={(cands.data ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${CITY[c.city]?.[0] ?? c.city}` }))} /></Field>
        ) : (
          <Field label="Hotel name" className="span-all" hint={!h ? "Saved as a draft under Hotels so the team can add photos and details" : undefined}><Input value={f.name} onChange={(e) => set("name")(e.target.value)} /></Field>
        )}
        <Field label="City"><Select value={linked?.city ?? f.city} disabled={!!linked} onChange={(e) => set("city")(e.target.value as "makkah" | "madinah")} options={[{ value: "makkah", label: "Makkah" }, { value: "madinah", label: "Madinah" }]} /></Field>
        <Field label="Stars"><Select value={f.star_rating} onChange={(e) => set("star_rating")(e.target.value)} options={["1", "2", "3", "4", "5"].map((n) => ({ value: n, label: `${n}★` }))} /></Field>
        <Field label="Distance to Haram" hint="Metres, used for sorting"><NumInput value={f.distance_m} onChange={set("distance_m")} pre="m" /></Field>
        <Field label="Shown as" hint="e.g. Haram view, 0 m · 3 min walk · Shuttle, 1.4 km"><Input value={f.distance_label} onChange={(e) => set("distance_label")(e.target.value)} /></Field>
      </div>
      <Panel className="svc-inner">
        <SubHead actions={<Btn size="sm" icon="plus" onClick={() => setF((x) => ({ ...x, rates: [...x.rates, { season: "", starts_on: "", ends_on: "", quad: "", triple: "", double: "", single: "" }] }))}>Add season</Btn>}>
          Prices per person per night
        </SubHead>
        <p className="muted" style={{ margin: 0 }}>The row without dates is the base rate. Seasons with dates (Ramadan, winter holidays) replace it for nights inside their dates.</p>
        <div className="tbl-wrap">
          <table className="svc-rates">
            <thead><tr><th>Season</th><th>From</th><th>To</th><th className="num">Quad</th><th className="num">Triple</th><th className="num">Double</th><th className="num">Single</th><th /></tr></thead>
            <tbody>
              {f.rates.map((r, i) => (
                <tr key={i}>
                  <td><Input aria-label="Season" value={r.season} placeholder="Season" onChange={(e) => updR(i, { season: e.target.value })} /></td>
                  <td><Input type="date" aria-label="From" value={r.starts_on} onChange={(e) => updR(i, { starts_on: e.target.value })} /></td>
                  <td><Input type="date" aria-label="To" value={r.ends_on} onChange={(e) => updR(i, { ends_on: e.target.value })} /></td>
                  {(["quad", "triple", "double", "single"] as const).map((k) => <td key={k}><NumInput aria-label={k} value={r[k]} onChange={(v) => updR(i, { [k]: v })} /></td>)}
                  <td><IconBtn icon="trash" label="Remove season" onClick={() => setF((x) => ({ ...x, rates: x.rates.filter((_, j) => j !== i) }))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <SwitchRow title="Live in flexible packages" checked={f.is_live} onChange={set("is_live")} />
      <div className="row svc-foot">
        {canSave && <Btn variant="gold" icon="check" busy={busy} onClick={save}>{h ? "Save hotel" : "Add hotel"}</Btn>}
        <span style={{ flex: 1 }} />
        {h && canDelete && <Btn variant="danger" icon="trash" onClick={async () => { if (await del(`/umrah/hotels/${h.hotel_id}`, "this hotel from Umrah", "Its Umrah rates and package choices are removed. The hotel stays in the Hotels catalogue.")) { onSaved(); onClose(); } }}>Remove from Umrah</Btn>}
      </div>
    </>
  );
}
