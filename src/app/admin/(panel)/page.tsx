"use client";
// Overview: this month's KPIs, revenue chart, what needs attention, service mix,
// next departures and recent activity, all from real bookings and enquiries.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useData } from "@/admin/api";
import { ago, date } from "@/admin/format";
import type { IconName } from "@/admin/icons";
import { BookingDrawer, Thumb } from "@/admin/ops/booking-drawer";
import { BookingFormModal } from "@/admin/ops/booking-forms";
import { AreaChart, Donut, MIX_COLORS } from "@/admin/ops/charts";
import { TYPE_LABEL, type ProductType } from "@/admin/ops/status";
import { Guard, useMe } from "@/admin/shell";
import { Btn, cx, Empty, ErrorNote, Icon, Kpi, Loading, PageHead, Pill } from "@/admin/ui";

type Overview = {
  kpis: {
    bookings: number; bookings_prev: number; revenue: number; revenue_prev: number; margin: number | null;
    awaiting: number; awaiting_n: number; slips: number; enquiries_new: number; enquiries_old: number; conversion: number | null;
  };
  spark: { bookings: number[]; revenue: number[]; awaiting: number[]; enquiries: number[] };
  series: { d: string; v: number }[]; range: string;
  mix: { type: string; n: number; v: number }[]; mixLabel: string;
  upcoming: { id: string; ref: string; lead_name: string; product_name: string; product_type: string; start_date: string; end_date: string | null; status: string; image: string | null }[];
  needs: { icon: string; tone: string; title: string; sub: string; href: string }[];
  activity: { kind: string; title: string; sub: string; at: string; href: string }[];
  can: { bookings: boolean; enquiries: boolean; newBooking: boolean };
};

const short = (v: number) => (v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : `${Math.round(v)}`);
const pct = (now: number, prev: number) => (prev > 0 ? Math.round(((now - prev) / prev) * 100) : null);
const prevMonth = () => new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString("en-GB", { month: "long" });

function Delta({ v }: { v: number | null }) {
  if (v == null) return null;
  return <span className={v >= 0 ? "up" : "down"}>{v >= 0 ? "+" : ""}{v}%</span>;
}

export default function OverviewPage() {
  return <Guard perm="overview.main"><Overview /></Guard>;
}

function Overview() {
  const me = useMe();
  const router = useRouter();
  const [range, setRange] = useState("30");
  const { data, error, reload } = useData<Overview>(`/overview?range=${range}`);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = me.name.split(" ")[0];
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (error) return <ErrorNote error={error} />;
  if (!data) return <><PageHead eyebrow={today} title={<>{greet}, <em>{first}</em></>} /><Loading /></>;

  const k = data.kpis;
  const rev = pct(k.revenue, k.revenue_prev);
  const n = data.needs.length;
  const sub = [
    n ? `${n === 1 ? "One thing needs" : `${["", "", "Two", "Three", "Four", "Five", "Six"][n] ?? n} things need`} you today.` : "Nothing urgent today.",
    data.can.bookings && rev != null ? `Revenue is ${rev >= 0 ? "up" : "down"} ${Math.abs(rev)}% on last month.` : "",
  ].join(" ");

  const points = data.series.map((p, i) => ({
    label: data.range === "year" ? p.d : i === data.series.length - 1 ? "Today" : date(p.d, false),
    v: p.v,
  }));
  const mixTotal = data.mix.reduce((s, x) => s + x.v, 0);
  const mixN = data.mix.reduce((s, x) => s + x.n, 0);
  const mix = data.mix.length > 6
    ? [...data.mix.slice(0, 5), { type: "other", n: data.mix.slice(5).reduce((s, x) => s + x.n, 0), v: data.mix.slice(5).reduce((s, x) => s + x.v, 0) }]
    : data.mix;

  return (
    <>
      <PageHead eyebrow={today} title={<>{greet}, <em>{first}</em></>} sub={sub}>
        {data.can.enquiries && <Link className="btn" href="/admin/enquiries"><Icon name="inbox" />Enquiries</Link>}
        {data.can.newBooking && <Btn variant="gold" icon="plus" onClick={() => setCreating(true)}>New booking</Btn>}
      </PageHead>

      <div className="grid g-kpi" style={{ marginBottom: 16 }}>
        {data.can.bookings && <>
          <Kpi label="Bookings this month" icon="ticket" value={k.bookings} spark={data.spark.bookings}
            delta={<><Delta v={pct(k.bookings, k.bookings_prev)} /> vs {prevMonth()}</>} />
          <Kpi label="Revenue" icon="spark" unit="PKR" value={short(k.revenue)} spark={data.spark.revenue}
            delta={<><Delta v={rev} />{rev != null && k.margin != null ? " · " : ""}{k.margin != null ? `margin ${k.margin.toFixed(1)}%` : ""}{rev == null && k.margin == null ? "This month" : ""}</>} />
          <Kpi label="Awaiting payment" icon="clock" unit="PKR" value={short(k.awaiting)} spark={data.spark.awaiting} color="var(--warn)"
            delta={`${k.awaiting_n} booking${k.awaiting_n === 1 ? "" : "s"} · ${k.slips} slip${k.slips === 1 ? "" : "s"} to verify`} />
        </>}
        {data.can.enquiries && (
          <Kpi label="New enquiries" icon="inbox" value={k.enquiries_new} spark={data.spark.enquiries} color="var(--signal)"
            delta={<>{k.enquiries_old ? <span className="down">{k.enquiries_old} older than 4 h</span> : "All answered in time"}{k.conversion != null ? ` · ${Math.round(k.conversion)}% convert` : ""}</>} />
        )}
      </div>

      <div className={cx("grid", data.can.bookings && "g-ov")} style={{ marginBottom: 16 }}>
        {data.can.bookings && (
          <div className="panel">
            <div className="panel-h">
              <h2>Revenue</h2><span className="lbl">{data.range === "year" ? "Last 12 months" : `Last ${data.range} days`} · PKR</span><span className="spacer" />
              <div className="chips">
                {[["7", "7 d"], ["30", "30 d"], ["year", "Year"]].map(([v, l]) => (
                  <button key={v} type="button" className="chip" aria-pressed={range === v} onClick={() => setRange(v)}>{l}</button>
                ))}
              </div>
            </div>
            <AreaChart points={points} label={`Revenue, ${data.range === "year" ? "last 12 months" : `last ${data.range} days`}`} />
          </div>
        )}
        <div className="panel">
          <div className="panel-h"><h2>Needs you</h2><span className="spacer" />{n > 0 && <Pill tone="warn">{n}</Pill>}</div>
          {n ? (
            <div className="list">
              {data.needs.map((x) => (
                <Link key={x.title} className="li ops-li" href={x.href}>
                  <span className={cx("pill", "nodot", x.tone)} style={{ padding: 8 }}><Icon name={x.icon as IconName} /></span>
                  <span className="grow"><b style={{ display: "block", fontSize: 13 }}>{x.title}</b><span className="t2 trunc" style={{ display: "block" }}>{x.sub}</span></span>
                  <Icon name="chev" />
                </Link>
              ))}
            </div>
          ) : <Empty icon="check" title="All clear">No slips, refunds or missing passports waiting.</Empty>}
        </div>
      </div>

      <div className="grid g-3">
        {data.can.bookings && (
          <div className="panel">
            <div className="panel-h"><h2>Sales by service</h2><span className="lbl">{data.mixLabel}</span></div>
            {mix.length ? (
              <div className="row" style={{ gap: 18, flexWrap: "nowrap" }}>
                <Donut parts={mix.map((x) => ({ label: TYPE_LABEL[x.type as ProductType] ?? x.type, value: x.v }))} center={String(mixN)} caption="Bookings" />
                <div style={{ display: "flex", flexDirection: "column", gap: 9, minWidth: 0, flex: 1 }}>
                  {mix.map((x, i) => (
                    <div key={x.type} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                      <i style={{ width: 10, height: 10, borderRadius: 3, background: MIX_COLORS[i % MIX_COLORS.length], flex: "none" }} />
                      <span className="trunc">{TYPE_LABEL[x.type as ProductType] ?? x.type}</span>
                      <b className="tab" style={{ marginLeft: "auto", paddingLeft: 8 }}>{mixTotal ? Math.round((x.v / mixTotal) * 100) : 0}%</b>
                    </div>
                  ))}
                </div>
              </div>
            ) : <Empty icon="spark" title="No sales yet">Bookings will show here by service.</Empty>}
          </div>
        )}
        {data.can.bookings && (
          <div className="panel">
            <div className="panel-h"><h2>Next departures</h2><span className="spacer" /><Link className="btn btn-sm btn-ghost" href="/admin/bookings">All</Link></div>
            {data.upcoming.length ? (
              <div className="list">
                {data.upcoming.map((b) => (
                  <button key={b.id} type="button" className="li ops-li" onClick={() => setOpen(b.ref)}>
                    <Thumb image={b.image} type={b.product_type} />
                    <span className="grow"><b className="trunc" style={{ display: "block", fontSize: 13 }}>{b.lead_name}</b><span className="t2 trunc" style={{ display: "block" }}>{b.product_name}</span></span>
                    <span className="mono" style={{ color: "var(--gold)", whiteSpace: "nowrap" }}>{date(b.start_date, false)}</span>
                  </button>
                ))}
              </div>
            ) : <Empty icon="plane" title="No trips coming up" />}
          </div>
        )}
        <div className="panel">
          <div className="panel-h"><h2>Live activity</h2><span className="spacer" /><Pill tone="sig">Live</Pill></div>
          {data.activity.length ? (
            <ul className="timeline">
              {data.activity.map((a, i) => (
                <li key={i}>
                  <span className={cx("dt", a.kind === "payment" ? "s" : a.kind === "status" && /Confirm|Complet/.test(a.title) ? "g" : a.kind === "enquiry" ? "s" : "")} />
                  <Link href={a.href} className="ops-act" style={{ minWidth: 0 }}><b style={{ fontSize: 13 }}>{a.title}</b><br /><small className="trunc" style={{ display: "block" }}>{a.sub}</small></Link>
                  <small>{ago(a.at)}</small>
                </li>
              ))}
            </ul>
          ) : <Empty icon="clock" title="Nothing yet" />}
        </div>
      </div>

      <BookingDrawer idOrRef={open} onClose={() => setOpen(null)} onChanged={reload} />
      {creating && <BookingFormModal open onClose={() => setCreating(false)} onSaved={(b) => { setCreating(false); router.push(`/admin/bookings/all?open=${b.ref}`); }} />}
    </>
  );
}
