"use client";
// Bookings: one sub-tab per status, KPIs, in-page search, CSV export, the booking
// drawer (?open=<ref>) and the "New booking" form.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import { useData } from "@/admin/api";
import { ago, date, fmt, pkr } from "@/admin/format";
import { BookingDrawer, PayPill, StatusPill, Thumb } from "@/admin/ops/booking-drawer";
import { BookingFormModal } from "@/admin/ops/booking-forms";
import { CHANNELS, channelLabel, paxText, TYPE_LABEL, type ProductType } from "@/admin/ops/status";
import type { BookingRow } from "@/admin/ops/types";
import { tabOf } from "@/admin/section-index";
import { Guard, NoAccess, useCan, useMe } from "@/admin/shell";
import { Btn, ErrorNote, Icon, Loading, PageHead, Search, Select } from "@/admin/ui";

type Kpis = {
  checkins: number; checkin_names: string | null; balance: number; on_deposit: number; supplier: number; supplier_oldest: string | null;
  recent: number; recent_cancelled: number;
};

const SUB: Record<string, string> = {
  all: "Every confirmed or pending reservation. Enquiries live on their own page until they become a booking.",
  pending: "Bookings waiting for the guest's payment, or for you to check a slip.",
  supplier: "Paid bookings waiting for the hotel or supplier to confirm.",
  confirmed: "Confirmed and ready to travel. Send vouchers from the booking.",
  travelling: "Guests who are travelling right now.",
  completed: "Trips that have finished.",
  refund: "Cancelled bookings with money still to go back to the guest.",
  cancelled: "Cancelled bookings, refunded or not refundable.",
};

const short = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : fmt(v));

export default function BookingsTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  const t = tabOf("bookings", tab);
  if (!t) return <NoAccess />;
  return (
    <Guard perm={`bookings.${tab}`}>
      <Suspense fallback={<Loading />}><Bookings tab={tab} title={tab === "all" ? "All bookings" : t.label} /></Suspense>
    </Guard>
  );
}

function Bookings({ tab, title }: { tab: string; title: string }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const open = sp.get("open");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [type, setType] = useState("");
  const [channel, setChannel] = useState("");
  const [creating, setCreating] = useState(false);
  const canAll = useCan("bookings.all", "create");
  const canPending = useCan("bookings.pending", "create");
  const canCreate = canAll || canPending;

  useEffect(() => {
    const id = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const { data, error, loading, reload } = useData<{ rows: BookingRow[]; kpis: Kpis }>(`/bookings?tab=${tab}${term ? `&q=${encodeURIComponent(term)}` : ""}`);
  const rows = useMemo(() => (data?.rows ?? []).filter((b) => (!type || b.product_type === type) && (!channel || b.channel.toLowerCase() === channel)), [data, type, channel]);

  const setOpen = (ref: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (ref) p.set("open", ref); else p.delete("open");
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  };

  const k = data?.kpis;
  const oldest = k?.supplier_oldest ? ago(k.supplier_oldest).replace(/ ago$/, "") : null;
  const exportHref = `/api/admin/bookings/export?tab=${tab}${term ? `&q=${encodeURIComponent(term)}` : ""}`;

  return (
    <>
      <PageHead eyebrow="Bookings" title={title} sub={SUB[tab]}>
        {me.limits.canExport && <a className="btn" href={exportHref} download><Icon name="dl" />Export</a>}
        {canCreate && <Btn variant="gold" icon="plus" onClick={() => setCreating(true)}>New booking</Btn>}
      </PageHead>

      {k && (
        <div className="grid g-kpi" style={{ marginBottom: 16 }}>
          {([
            ["Today’s check-ins", String(k.checkins), k.checkin_names || "No arrivals today"],
            ["Balance to collect", `PKR ${short(k.balance)}`, `${k.on_deposit} booking${k.on_deposit === 1 ? "" : "s"} on deposit`],
            ["Supplier pending", String(k.supplier), oldest ? `Oldest: ${oldest}` : "Nothing waiting"],
            ["Cancellation rate", k.recent ? `${((k.recent_cancelled / k.recent) * 100).toFixed(1)}%` : "0%", "Last 90 days"],
          ] as const).map(([l, v, d]) => (
            <div key={l} className="panel kpi"><div className="lbl">{l}</div><div className="v tab">{v}</div><div className="d trunc">{d}</div></div>
          ))}
        </div>
      )}

      <div className="panel">
        <div className="row" style={{ marginBottom: 14 }}>
          <Search value={q} onChange={setQ} placeholder="Reference, guest, phone or passport" />
          <Select aria-label="Product type" value={type} onChange={(e) => setType(e.target.value)} placeholder="All products"
            options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} style={{ width: "auto" }} />
          <Select aria-label="Channel" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="All channels"
            options={CHANNELS.map(([value, label]) => ({ value, label }))} style={{ width: "auto" }} />
          {loading && data && <span className="spin" />}
        </div>
        <ErrorNote error={error} />
        {!data && !error ? <Loading /> : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Reference</th><th>Lead guest</th><th>Product</th><th>Travel</th><th>Guests</th><th className="num">Total</th><th>Payment</th><th>Status</th><th>Channel</th></tr></thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="click" tabIndex={0} onClick={() => setOpen(b.ref)} onKeyDown={(e) => e.key === "Enter" && setOpen(b.ref)}>
                    <td><span className="mono" style={{ color: "var(--gold)" }}>{b.ref}</span><div className="t2">{ago(b.created_at)}</div></td>
                    <td><b>{b.lead_name}</b><div className="t2 tab">{b.lead_phone}</div></td>
                    <td>
                      <div className="row" style={{ flexWrap: "nowrap" }}>
                        <Thumb image={b.image} type={b.product_type} />
                        <div style={{ minWidth: 0 }}><b>{b.product_name}</b><div className="t2">{TYPE_LABEL[b.product_type as ProductType] ?? b.product_type}</div></div>
                      </div>
                    </td>
                    <td className="tab" style={{ whiteSpace: "nowrap" }}>{date(b.start_date, false)}{b.end_date && b.end_date !== b.start_date ? ` – ${date(b.end_date, false)}` : ""}</td>
                    <td>{paxText(b.adults, b.children, b.infants)}</td>
                    <td className="num tab"><b>{pkr(b.total_amount)}</b><div className="t2">{b.paid_amount >= b.total_amount ? "Paid in full" : `Balance ${fmt(b.total_amount - b.paid_amount)}`}</div></td>
                    <td><PayPill s={b.payment_status} /></td>
                    <td><StatusPill s={b.status} /></td>
                    <td>{channelLabel(b.channel)}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>{term || type || channel ? "No bookings match your search." : "No bookings with this status."}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BookingDrawer idOrRef={open} onClose={() => setOpen(null)} onChanged={reload} />
      {creating && <BookingFormModal open onClose={() => setCreating(false)} onSaved={(b) => { setCreating(false); reload(); setOpen(b.ref); }} />}
    </>
  );
}
