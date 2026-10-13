"use client";
// Excursion editor: the 11 sections of the approved design, shown as sub-tabs in the left rail.
import { useMemo } from "react";
import { ago, fmt, siteUrl, slugify } from "../format";
import { useCan, useMe } from "../shell";
import { Btn, ErrorNote, Field, Icon, IconBtn, Input, Loading, Pill, PreInput, Select, Switch, SwitchRow, Tags, Textarea } from "../ui";
import {
  ACTIVITY, CONFIRMS, DAYS, emptyExcursion, emptyOption, EXC_CANCEL, EXC_CATEGORIES, EXC_SUPPLIERS, excChecks, GROUP_TYPES, GUIDES, lowestAdult,
  photoIssue, quality, WEATHER, type ExcDoc, type ExcOption, type Stop, type Zone,
} from "./model";
import { EditorFrame, Num, PhotoGrid, PreNum, QualityPanel, statusLabel, statusTone, useDestinations, useEditorDoc, type EdSection } from "./parts";

type Meta = { updated_at: string; updated_by: string | null; price_from: number | null; hide_costs: boolean; week: { day: string; guests: number }[] };

const withCurrent = (list: string[], v: string) => (!v || list.includes(v) ? list : [v, ...list]);
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ExcursionEditor({ id }: { id: string }) {
  const ed = useEditorDoc<ExcDoc, Meta>("excursions", id, emptyExcursion);
  const dests = useDestinations("excursions");
  const canEdit = useCan("excursions", ed.isNew ? "create" : "edit");
  const hideCosts = useMe().limits.hideCosts;
  const { doc, set } = ed;
  const price = useMemo(() => (doc ? lowestAdult(doc.options) : null), [doc]);

  if (ed.error) return <ErrorNote error={ed.error} />;
  if (ed.loading || !doc) return <Loading />;

  const dest = dests.find((d) => d.id === doc.destination_id);
  const cur = doc.currency_code;
  const setStop = (i: number, p: Partial<Stop>) => set("itinerary", doc.itinerary.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const moveStop = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= doc.itinerary.length) return;
    const next = [...doc.itinerary];
    [next[i], next[j]] = [next[j], next[i]];
    set("itinerary", next);
  };
  const setOpt = (i: number, p: Partial<ExcOption>) => set("options", doc.options.map((o, j) => (j === i ? { ...o, ...p } : o)));
  const setZone = (i: number, p: Partial<Zone>) => set("pickup_zones", doc.pickup_zones.map((z, j) => (j === i ? { ...z, ...p } : z)));
  const checks = excChecks(doc);
  const warn = (k: string) => {
    const c = checks.find((x) => x.section === k);
    return c && !c.ok ? (k === "photos" ? photoIssue(doc.photos) : "Incomplete") : null;
  };
  const pct = quality(checks);
  const margin = (o: ExcOption) => (o.supplier_cost != null && o.adult_price > 0 ? Math.round(((o.adult_price - o.supplier_cost) / o.adult_price) * 100) : null);

  const sections: EdSection[] = [
    {
      key: "basics", label: "Basics", icon: "compass", sub: "The name, category and story of the experience.", warn: warn("basics"),
      body: (
        <div className="f-grid">
          <Field label="Title"><Input value={doc.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Desert Safari with BBQ Dinner" /></Field>
          <Field label="Category"><Select value={doc.category} onChange={(e) => set("category", e.target.value)} options={withCurrent(EXC_CATEGORIES, doc.category)} /></Field>
          <Field label="Destination">
            <Select value={doc.destination_id ?? ""} placeholder="Not linked" options={dests.map((d) => ({ value: d.id, label: `${d.name}, ${d.country}` }))} onChange={(e) => set("destination_id", e.target.value || null)} />
          </Field>
          <Field label="Where it happens" hint="Shown on the card, e.g. Lahbab Desert, Dubai"><Input value={doc.location_label} onChange={(e) => set("location_label", e.target.value)} /></Field>
          <Field label="Duration" hint="Shown on the card, e.g. 6 hours · Hotel pickup"><Input value={doc.duration_label} onChange={(e) => set("duration_label", e.target.value)} /></Field>
          <Field label="Duration in minutes" hint="Used for sorting and filters"><Num value={doc.duration_minutes} min={0} onChange={(v) => set("duration_minutes", v)} /></Field>
          <Field label="Activity level"><Select value={doc.activity_level} onChange={(e) => set("activity_level", e.target.value)} options={withCurrent(ACTIVITY, doc.activity_level)} /></Field>
          <Field label="Group type"><Select value={doc.group_type} onChange={(e) => set("group_type", e.target.value)} options={withCurrent(GROUP_TYPES, doc.group_type)} /></Field>
          <Field label="Short summary" hint={`Shown on list cards · ${doc.summary.length} of 160 characters`} className="span-all"><Input value={doc.summary} maxLength={200} onChange={(e) => set("summary", e.target.value)} /></Field>
          <Field label="Full description" className="span-all"><Textarea rows={5} value={doc.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Highlights" hint="Up to 6, shown as chips" className="span-all"><Tags value={doc.highlights} onChange={(v) => set("highlights", v.slice(0, 12))} /></Field>
        </div>
      ),
    },
    {
      key: "itin", label: "Itinerary", icon: "route", sub: "Stops in order, so guests know exactly what happens when.", warn: warn("itin"),
      body: (
        <>
          <ul className="timeline">
            {doc.itinerary.map((s, i) => (
              <li key={i} style={{ gridTemplateColumns: "18px minmax(0,1fr) auto" }}>
                <span className={`dt ${i ? "" : "s"}`} />
                <div className="f-grid c4">
                  <Field label="Time"><Input type="time" value={s.time} onChange={(e) => setStop(i, { time: e.target.value })} /></Field>
                  <Field label="Stop" className="span2"><Input value={s.title} onChange={(e) => setStop(i, { title: e.target.value })} placeholder="e.g. Hotel pickup" /></Field>
                  <Field label="How long"><Input value={s.duration} onChange={(e) => setStop(i, { duration: e.target.value })} placeholder="45 min" /></Field>
                  <Field label="What happens" className="span-all"><Input value={s.description} onChange={(e) => setStop(i, { description: e.target.value })} /></Field>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <IconBtn icon="back" label="Move up" style={{ transform: "rotate(90deg)" }} disabled={i === 0} onClick={() => moveStop(i, -1)} />
                  <IconBtn icon="chev" label="Move down" style={{ transform: "rotate(90deg)" }} disabled={i === doc.itinerary.length - 1} onClick={() => moveStop(i, 1)} />
                  <IconBtn icon="trash" label="Remove stop" onClick={() => set("itinerary", doc.itinerary.filter((_, j) => j !== i))} />
                </div>
              </li>
            ))}
          </ul>
          <Btn size="sm" icon="plus" onClick={() => set("itinerary", [...doc.itinerary, { time: "", title: "", duration: "", description: "" }])}>Add stop</Btn>
        </>
      ),
    },
    {
      key: "sched", label: "Schedule & capacity", icon: "clock", sub: "When it runs and how many guests each slot can take.", warn: warn("sched"),
      body: (
        <>
          <div className="fld">
            <span className="lab">Runs on</span>
            <div className="chips">
              {DAYS.map((d) => (
                <button key={d} type="button" className="chip" aria-pressed={doc.days_of_week.includes(d)} onClick={() => set("days_of_week", doc.days_of_week.includes(d) ? doc.days_of_week.filter((x) => x !== d) : DAYS.filter((x) => x === d || doc.days_of_week.includes(x)))}>{d}</button>
              ))}
            </div>
          </div>
          <div className="f-grid c4" style={{ marginTop: 14 }}>
            <Field label="Start times" hint="24-hour, e.g. 15:00" className="span2"><Tags value={doc.start_times} placeholder="15:00 and press Enter" onChange={(v) => set("start_times", v.filter((t) => /^\d{2}:\d{2}$/.test(t)).sort())} /></Field>
            <Field label="Guests per slot"><Num value={doc.capacity} min={1} onChange={(v) => set("capacity", v)} /></Field>
            <Field label="Minimum guests"><Num value={doc.min_guests} min={1} onChange={(v) => set("min_guests", v ?? 1)} /></Field>
            <Field label="Booking closes">
              <Select value={String(doc.cutoff_hours)} onChange={(e) => set("cutoff_hours", Number(e.target.value))} options={withCurrent(["2", "6", "12", "24", "48", "72"], String(doc.cutoff_hours)).map((h) => ({ value: h, label: `${h} hours before` }))} />
            </Field>
            <Field label="Season from" hint="Leave empty for all year"><Input type="date" value={doc.season_from ?? ""} onChange={(e) => set("season_from", e.target.value || null)} /></Field>
            <Field label="Season to"><Input type="date" value={doc.season_to ?? ""} onChange={(e) => set("season_to", e.target.value || null)} /></Field>
            <Field label="Blackout dates" hint="Dates or holidays it doesn’t run" className="span-all"><Tags value={doc.blackout_dates} onChange={(v) => set("blackout_dates", v)} /></Field>
          </div>
        </>
      ),
    },
    {
      key: "price", label: "Options & pricing", icon: "tag", sub: "Each option has its own prices by age band. Leave a child or infant price empty when that age can’t book.", warn: warn("price"),
      body: (
        <>
          <div className="list">
            {doc.options.map((o, i) => (
              <div key={o.key} className="li cat-rate">
                <Field label="Option" className="cat-rate-name"><Input value={o.name} placeholder="e.g. Shared 4x4" onChange={(e) => setOpt(i, { name: e.target.value })} /></Field>
                <Field label="Note for guests" className="span2"><Input value={o.note} placeholder="e.g. Seat in a shared vehicle" onChange={(e) => setOpt(i, { note: e.target.value })} /></Field>
                <Field label={o.price_basis === "group" ? "Priced per · group size" : "Priced per"}>
                  <div className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
                    <Select value={o.price_basis} onChange={(e) => setOpt(i, { price_basis: e.target.value as ExcOption["price_basis"] })} options={[{ value: "person", label: "Person" }, { value: "group", label: "Group" }]} />
                    {o.price_basis === "group" && <Num value={o.max_group} min={1} placeholder="Up to" aria-label="Group size" style={{ width: 58, flex: "none", paddingLeft: 8, paddingRight: 4 }} onChange={(v) => setOpt(i, { max_group: v })} />}
                  </div>
                </Field>
                <Field label={o.price_basis === "group" ? "Price per group" : "Adult 12+"}><PreNum pre={cur} value={o.adult_price} min={0} onChange={(v) => setOpt(i, { adult_price: v ?? 0 })} /></Field>
                <Field label="Child 3–11"><PreNum pre={cur} value={o.child_price} min={0} placeholder="Not allowed" onChange={(v) => setOpt(i, { child_price: v })} /></Field>
                <Field label="Infant 0–2" hint={o.infant_price === 0 ? "Free" : undefined}><PreNum pre={cur} value={o.infant_price} min={0} placeholder="Not allowed" onChange={(v) => setOpt(i, { infant_price: v })} /></Field>
                {!hideCosts ? (
                  <Field label={o.price_basis === "group" ? "Your cost per group" : "Your cost per adult"} hint={margin(o) != null ? <span style={{ color: margin(o)! < 10 ? "var(--warn)" : "var(--good)" }}>Margin {margin(o)}%</span> : undefined}>
                    <PreNum pre={cur} value={o.supplier_cost ?? null} min={0} onChange={(v) => setOpt(i, { supplier_cost: v })} />
                  </Field>
                ) : <div />}
                <div className="cat-rate-end" style={{ gridColumn: "1/-1" }}>
                  <span className="muted" style={{ fontSize: 12.5 }}>{o.is_live ? "Bookable on the website" : "Hidden from guests"}</span>
                  <Switch checked={o.is_live} onChange={(v) => setOpt(i, { is_live: v })} label={`${o.name || "Option"} live`} />
                  <IconBtn icon="trash" label="Remove option" onClick={() => set("options", doc.options.filter((_, j) => j !== i))} />
                </div>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <Btn size="sm" icon="plus" onClick={() => set("options", [...doc.options, emptyOption()])}>Add option</Btn>
            <span className="spacer" />
            <span className="muted" style={{ fontSize: 13 }}>Website shows from <b style={{ color: "var(--gold)" }}>{price != null ? `${cur} ${fmt(price)}` : "–"}</b> per adult</span>
          </div>
          <div className="f-grid c3" style={{ marginTop: 14 }}>
            <Field label="Group discount">
              <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}><PreNum pre="%" value={doc.group_discount_pct} min={0} max={90} onChange={(v) => set("group_discount_pct", v)} aria-label="Discount percent" /></div>
                <div style={{ flex: 1.3, minWidth: 0 }}><PreNum pre="guests" value={doc.group_discount_min} min={2} onChange={(v) => set("group_discount_min", v)} aria-label="From number of guests" /></div>
              </div>
            </Field>
            <Field label="Peak season uplift"><PreNum pre="+%" value={doc.peak_uplift_pct} min={0} onChange={(v) => set("peak_uplift_pct", v)} /></Field>
            <Field label="Peak season dates">
              <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
                <Input type="date" style={{ minWidth: 0 }} value={doc.peak_from ?? ""} aria-label="Peak from" onChange={(e) => set("peak_from", e.target.value || null)} />
                <Input type="date" style={{ minWidth: 0 }} value={doc.peak_to ?? ""} aria-label="Peak to" onChange={(e) => set("peak_to", e.target.value || null)} />
              </div>
            </Field>
          </div>
        </>
      ),
    },
    {
      key: "inc", label: "What’s included", icon: "check", sub: "Clear inclusions cut down on complaints.", warn: warn("inc"),
      body: (
        <div className="grid g-2">
          <Field label="Included"><Tags value={doc.inclusions} onChange={(v) => set("inclusions", v)} /></Field>
          <Field label="Not included"><Tags value={doc.exclusions} onChange={(v) => set("exclusions", v)} /></Field>
        </div>
      ),
    },
    {
      key: "meet", label: "Pickup & meeting point", icon: "pin", sub: "Pickup zones with times and any extra charge.",
      body: (
        <>
          <SwitchRow title="Hotel pickup offered" sub="Guests enter their hotel at checkout" checked={doc.pickup_offered} onChange={(v) => set("pickup_offered", v)} />
          {doc.pickup_offered && (
            <>
              <div className="tbl-wrap">
                <table className="cat-edit">
                  <thead><tr><th>Zone</th><th>Pickup window</th><th className="num">Extra charge ({cur})</th><th /></tr></thead>
                  <tbody>
                    {doc.pickup_zones.map((z, i) => (
                      <tr key={i}>
                        <td><Input value={z.zone} aria-label="Zone" style={{ minWidth: 200 }} onChange={(e) => setZone(i, { zone: e.target.value })} /></td>
                        <td><Input value={z.window} aria-label="Pickup window" placeholder="15:00–15:20" style={{ width: 140 }} onChange={(e) => setZone(i, { window: e.target.value })} /></td>
                        <td className="num"><Num value={z.fee || null} min={0} aria-label="Extra charge" placeholder="Included" style={{ width: 120, marginLeft: "auto" }} onChange={(v) => setZone(i, { fee: v ?? 0 })} /></td>
                        <td><IconBtn icon="trash" label="Remove zone" onClick={() => set("pickup_zones", doc.pickup_zones.filter((_, j) => j !== i))} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Btn size="sm" icon="plus" style={{ marginTop: 10 }} onClick={() => set("pickup_zones", [...doc.pickup_zones, { zone: "", window: "", fee: 0 }])}>Add pickup zone</Btn>
            </>
          )}
          <div className="f-grid" style={{ marginTop: 14 }}>
            <Field label={doc.pickup_offered ? "Meeting point if no pickup" : "Meeting point"}><Input value={doc.meeting_point} onChange={(e) => set("meeting_point", e.target.value)} /></Field>
            <Field label="Map link" hint="Google Maps link to the meeting point"><Input value={doc.meeting_map_url} placeholder="https://maps.google.com/…" onChange={(e) => set("meeting_map_url", e.target.value.trim())} /></Field>
            <Field label="Ends at"><Input value={doc.ends_at} onChange={(e) => set("ends_at", e.target.value)} placeholder="Back at pickup point" /></Field>
          </div>
        </>
      ),
    },
    {
      key: "guide", label: "Guide & languages", icon: "users", sub: "Who leads the experience and which languages they speak.",
      body: (
        <div className="f-grid">
          <Field label="Guide"><Select value={doc.guide_type} onChange={(e) => set("guide_type", e.target.value)} options={withCurrent(GUIDES, doc.guide_type)} /></Field>
          <Field label="Languages"><Tags value={doc.languages} onChange={(v) => set("languages", v)} /></Field>
        </div>
      ),
    },
    {
      key: "req", label: "Who it suits", icon: "shield", sub: "Health, age and accessibility notes shown before booking.",
      body: (
        <div className="f-grid">
          <Field label="Not suitable for"><Tags value={doc.not_suitable} onChange={(v) => set("not_suitable", v)} /></Field>
          <Field label="What to bring"><Tags value={doc.what_to_bring} onChange={(v) => set("what_to_bring", v)} /></Field>
          <Field label="Minimum age">
            <Select value={doc.min_age == null ? "" : String(doc.min_age)} placeholder="No minimum" onChange={(e) => set("min_age", e.target.value === "" ? null : Number(e.target.value))} options={withCurrent(["3", "5", "6", "12", "16", "18"], doc.min_age == null ? "" : String(doc.min_age))} />
          </Field>
          <Field label="Dress code"><Input value={doc.dress_code} onChange={(e) => set("dress_code", e.target.value)} placeholder="e.g. Modest clothing at the camp" /></Field>
        </div>
      ),
    },
    {
      key: "cancel", label: "Cancellation", icon: "refresh", sub: "Shown before payment and on the voucher.", warn: warn("cancel"),
      body: (
        <div className="f-grid">
          <Field label="Policy"><Select value={doc.cancellation_policy} placeholder="Choose a policy" onChange={(e) => set("cancellation_policy", e.target.value)} options={withCurrent(EXC_CANCEL, doc.cancellation_policy)} /></Field>
          <Field label="Bad weather"><Select value={doc.weather_policy} onChange={(e) => set("weather_policy", e.target.value)} options={withCurrent(WEATHER, doc.weather_policy)} /></Field>
        </div>
      ),
    },
    {
      key: "photos", label: "Photos", icon: "image", sub: "Day and evening pairs; the first pair is the cover on the website.", warn: warn("photos"),
      body: <PhotoGrid value={doc.photos} onChange={(v) => set("photos", v)} folder="excursions" />,
    },
    {
      key: "vis", label: "Visibility & supplier", icon: "globe", sub: "Where it appears, how search engines read it and who runs it.", warn: warn("vis"),
      body: (
        <>
          <div className="f-grid">
            <Field label="Status" hint={doc.status === "seasonal" ? "Seasonal experiences stay on the website, marked with their season" : undefined}>
              <Select value={doc.status} onChange={(e) => set("status", e.target.value as ExcDoc["status"])} options={[{ value: "published", label: "Published" }, { value: "seasonal", label: "Seasonal" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived (hidden)" }]} />
            </Field>
            <Field label="Price shown per"><Select value={doc.price_unit} onChange={(e) => set("price_unit", e.target.value)} options={withCurrent(["per person", "per vehicle", "per jeep", "per group"], doc.price_unit)} /></Field>
            <Field label="Page address" className="span-all" hint={doc.slug ? undefined : "Made from the title when you save"}>
              <PreInput pre="skyholidays.pk/excursions/" value={doc.slug} placeholder={slugify(doc.title)} onChange={(e) => set("slug", slugify(e.target.value))} />
            </Field>
            <Field label="SEO title" className="span-all" hint={`${doc.seo_title.length} of 60 characters`}>
              <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
                <Input value={doc.seo_title} maxLength={70} onChange={(e) => set("seo_title", e.target.value)} />
                {!doc.seo_title && doc.title && <Btn size="sm" variant="ghost" onClick={() => set("seo_title", `${doc.title} | Sky Holidays`.slice(0, 70))}>Suggest</Btn>}
              </div>
            </Field>
            <Field label="Meta description" className="span-all" hint={`${doc.seo_description.length} of 160 characters`}><Textarea rows={2} value={doc.seo_description} onChange={(e) => set("seo_description", e.target.value)} /></Field>
            <Field label="Supplier"><Select value={doc.supplier} placeholder="None" onChange={(e) => set("supplier", e.target.value)} options={withCurrent(EXC_SUPPLIERS, doc.supplier)} /></Field>
            <Field label="Supplier product ID"><Input value={doc.supplier_product_id} onChange={(e) => set("supplier_product_id", e.target.value)} /></Field>
            <Field label="Supplier confirms"><Select value={doc.supplier_confirms} onChange={(e) => set("supplier_confirms", e.target.value)} options={withCurrent(CONFIRMS, doc.supplier_confirms)} /></Field>
          </div>
          <div style={{ marginTop: 8 }}>
            <SwitchRow title="Featured on the homepage" checked={doc.is_featured} onChange={(v) => set("is_featured", v)} />
          </div>
        </>
      ),
    },
  ];

  const cover = doc.photos[0]?.day;
  const sched = `${doc.days_of_week.length === 7 ? "Daily" : doc.days_of_week.join(", ") || "No days"}${doc.start_times.length ? ` · ${doc.start_times.slice(0, 2).join(", ")}${doc.start_times.length > 2 ? "…" : ""}` : ""}`;
  const cap = doc.capacity ?? 0;
  const side = (
    <>
      <div className="prev-card">
        <div className="prev-img" style={cover ? { backgroundImage: `url("${cover}")` } : { display: "grid", placeItems: "center", color: "var(--faint)" }}>
          {doc.duration_label && <span className="pill nodot">{doc.duration_label}</span>}
          {!cover && <Icon name="image" />}
        </div>
        <div className="prev-b">
          <h4>{doc.title || "New excursion"}</h4>
          <div style={{ color: "var(--muted)", fontSize: 12, margin: "2px 0 10px" }}>{dest?.name ?? "No destination"} · {sched}</div>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
            <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
              {doc.rating != null && <span className="score">{doc.rating.toFixed(1)}</span>}
              <span style={{ color: "var(--muted)", fontSize: 12 }}>{fmt(doc.review_count ?? 0)}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <b style={{ fontSize: 19, color: "var(--gold)" }} className="tab">{price != null ? `${cur} ${fmt(price)}` : "–"}</b>
              <div style={{ fontSize: 11, color: "var(--faint)" }}>{doc.price_unit === "per person" ? "per adult" : doc.price_unit}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--faint)", textAlign: "center" }}>Live preview of the website card</div>
      {ed.meta && (
        <div className="panel" style={{ padding: 16 }}>
          <h3 style={{ margin: "0 0 10px" }}>Next 7 days</h3>
          {ed.meta.week.map((w) => {
            const d = new Date(w.day + "T00:00:00Z");
            const full = cap > 0 && w.guests >= cap * 0.9;
            return (
              <div key={w.day} className="row" style={{ flexWrap: "nowrap", gap: 10, margin: "7px 0", fontSize: 12.5 }}>
                <span style={{ width: 52 }} className="tab">{WD[d.getUTCDay()]} {d.getUTCDate()}</span>
                <div className="meter" style={{ flex: 1 }}><i style={{ width: `${cap ? Math.min(100, (w.guests / cap) * 100) : 0}%`, ...(full ? { background: "var(--bad)" } : {}) }} /></div>
                <span className="tab" style={{ width: 56, textAlign: "right" }}>{w.guests}{cap ? `/${cap}` : ""}</span>
              </div>
            );
          })}
          <div className="faint" style={{ fontSize: 11.5 }}>Guests booked per day{cap ? `, ${cap} per slot` : ""}</div>
        </div>
      )}
      <QualityPanel checks={checks} />
    </>
  );

  return (
    <EditorFrame
      kind="excursions"
      eyebrow={ed.isNew ? "New excursion" : `Edit excursion${dest ? ` · ${dest.name}` : ""}`}
      title={doc.title || "New excursion"}
      pills={<>
        <Pill tone={statusTone(doc.status)} dot={doc.status !== "draft"}>{statusLabel(doc.status)}</Pill>
        {ed.meta && <Pill dot={false}>Saved {ago(ed.meta.updated_at).toLowerCase()}{ed.meta.updated_by ? ` by ${ed.meta.updated_by.split(" ")[0]}` : ""}</Pill>}
        <Pill tone="gold" dot={false}>Listing {pct}% complete</Pill>
        {ed.dirty && <Pill tone="warn">Unsaved changes</Pill>}
      </>}
      actions={<>
        {doc.slug && !ed.isNew && (doc.status === "published" || doc.status === "seasonal") && <a className="btn" href={siteUrl(`/excursions/${doc.slug}`)} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Icon name="eye" />Preview on site</a>}
        {canEdit && doc.status !== "published" && doc.status !== "seasonal" && <Btn busy={ed.busy} onClick={() => ed.save()}>Save draft</Btn>}
        {canEdit && <Btn variant="gold" icon="check" busy={ed.busy} onClick={() => ed.save(doc.status === "seasonal" ? undefined : { status: "published" })}>{doc.status === "published" || doc.status === "seasonal" ? "Publish changes" : "Publish"}</Btn>}
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
