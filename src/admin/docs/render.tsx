"use client";
/* eslint-disable @next/next/no-img-element -- A4 documents use plain <img> so they print and email as standalone HTML. */
// The printable A4 documents: hotel and transfer vouchers (cover photo + white card, copied
// from the client's reference voucher) and letterhead documents (invoice, quotation, visa
// letter, receipt). Everything is drawn from real booking data plus Branding and texts.
import type { CSSProperties, ReactNode } from "react";
import type { Branding, DocTexts } from "./defaults";
import { fillVars } from "./defaults";

/* ---------- data shapes (from GET /api/admin/documents/...) ---------- */

export type Bank = { bank_name: string; account_title: string; account_no: string | null; iban: string | null; branch: string | null } | null;
export type DocConfig = { branding: Branding; texts: DocTexts; business: Record<string, unknown>; bank: Bank };
export type DocBooking = {
  id: string; ref: string; product_type: string; product_name: string; product_snapshot: Record<string, unknown>; status: string; payment_status: string;
  start_date: string; end_date: string | null; adults: number; children: number; infants: number;
  lead_name: string; lead_email: string | null; lead_phone: string; currency_code: string;
  base_amount: number; tax_amount: number; fee_amount: number; discount_amount: number; total_amount: number; paid_amount: number;
  supplier_ref: string | null; payment_due_at: string | null; cancellation_policy: string | null; created_at: string;
};
export type DocTraveller = { id: string; title: string | null; full_name: string; kind: string; nationality_name: string | null; passport_no: string | null; passport_expiry: string | null };
export type DocPayment = { id: string; kind: string; method: string; provider: string | null; amount: number; currency_code: string; status: string; reference: string | null; received_at: string };
export type DocHotel = {
  id: string; slug: string; name: string; star_rating: number | null; address: string | null; description: string | null; phone: string | null; email: string | null;
  logo_url: string | null; voucher_image_url: string | null; image_day_url: string | null; image_night_url: string | null; image_url: string | null;
  check_in_time: string | null; check_out_time: string | null; city: string | null; country: string | null;
} | null;
export type DocData = { booking: DocBooking; travellers: DocTraveller[]; payments: DocPayment[]; hotel: DocHotel; destination: { city: string | null; country: string | null } | null };

export type Quote = {
  id?: string; number?: string; enquiry_id?: string | null; customer_name: string; customer_phone: string; customer_email: string; summary: string;
  price_label: string; col1_label: string; col2_label: string; items: { title: string; details: string; details2: string; price: number }[];
  included: string; valid_until: string; currency_code: string; created_at?: string; created_by_name?: string;
};

/* ---------- helpers ---------- */

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "13 Sep 2026": calendar dates as-is, timestamps in Karachi time. */
const D = (s: string | null | undefined) => {
  if (!s) return "";
  const d = s.length === 10 ? new Date(s + "T00:00:00Z") : new Date(new Date(s).getTime() + 5 * 3600e3);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const longDate = (d = new Date()) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" });
const today = () => D(new Date().toISOString());
const n0 = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
export const nightsBetween = (a: string, b: string | null) => (b ? Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 864e5)) : 1);
const time12 = (t: string | null | undefined) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const plural = (n: number, w: string, ws = w + "s") => `${n} ${n === 1 ? w : ws}`;
export const paxText = (b: Pick<DocBooking, "adults" | "children" | "infants">) =>
  [plural(b.adults, "Adult"), b.children ? plural(b.children, "Child", "Children") : "", b.infants ? plural(b.infants, "Infant") : ""].filter(Boolean).join(" ");
const snap = (b: DocBooking, ...keys: string[]) => {
  for (const k of keys) {
    const v = b.product_snapshot?.[k];
    if (v != null && v !== "") return String(v);
  }
  return "";
};
const refNo = (ref: string) => ref.replace(/^[A-Z]+-/, "");
export const docNumber = (kind: "INV" | "RCPT" | "VISA", ref: string, extra = "") => (kind === "VISA" ? `SKY/VISA/${refNo(ref).replace("-", "/")}` : `${kind}-${refNo(ref)}${extra}`);

/** Generated square monogram logo for hotels without one (same look as the approved preview). */
export function monogram(name: string, color = "#20345F") {
  const ini = name.replace(/[^A-Za-zÀ-ž ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect x="6" y="6" width="108" height="108" rx="26" fill="${color}"/><rect x="14" y="14" width="92" height="92" rx="20" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2"/><text x="60" y="74" text-anchor="middle" font-family="Georgia,serif" font-size="44" fill="#fff">${ini}</text></svg>`).replace(/'/g, "%27");
}
const PALETTE = ["#20345F", "#1F5C63", "#5B3A6E", "#7A4B22", "#2F4F2F", "#6B2737", "#2E4A7A"];
const colorFor = (s: string) => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function words999(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? "-" + ONES[r % 10] : "");
  return [h ? ONES[h] + " hundred" : "", rest].filter(Boolean).join(" ");
}
/** 338000 → "Three hundred thirty-eight thousand" */
export function amountWords(n: number) {
  n = Math.round(Math.abs(n));
  if (n === 0) return "Zero";
  const parts: string[] = [];
  for (const [v, w] of [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"], [1, ""]] as [number, string][]) {
    const c = Math.floor(n / v);
    if (c) { parts.push(words999(c) + (w ? " " + w : "")); n -= c * v; }
  }
  const s = parts.join(" ");
  return s[0].toUpperCase() + s.slice(1);
}
const CUR_WORD: Record<string, string> = { PKR: "rupees", AED: "dirhams", SAR: "riyals", USD: "dollars", GBP: "pounds", EUR: "euros" };

/* ---------- icons used on vouchers ---------- */

const VI: Record<string, string> = {
  cal: '<rect x="3" y="4.5" width="18" height="16" rx="1.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4M7 12.5h1M11 12.5h1M15 12.5h1M7 16h1M11 16h1M15 16h1"/>',
  moon: '<path d="M15 3a9 9 0 1 0 6 13.5A8 8 0 0 1 15 3z"/>',
  bed: '<path d="M2.5 19V7M2.5 15h19v4M21.5 15v-3a2 2 0 0 0-2-2h-17"/><rect x="5" y="7.5" width="5" height="2.5" rx=".5"/><rect x="12" y="7.5" width="5" height="2.5" rx=".5"/>',
  meal: '<path d="M6 3v7a2 2 0 0 0 2 2v9M10 3v7a2 2 0 0 1-2 2M8 3v6M17 21V3c-2 1-3 4-3 7v3h3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20a6 6 0 0 1 12 0M10 20a6 6 0 0 1 12 0"/>',
  doc: '<path d="M14 2.5H6a1 1 0 0 0-1 1v17a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7.5z"/><path d="M14 2.5v5h5M8.5 12h7M8.5 15h7M8.5 18h5"/>',
  clip: '<rect x="5" y="4" width="14" height="17.5" rx="1.5"/><path d="M9 4V2.5h6V4M8.5 9h7M8.5 12.5h7M8.5 16h5"/>',
  pin: '<path d="M12 21.5s-7-6.3-7-12a7 7 0 0 1 14 0c0 5.7-7 12-7 12z"/><circle cx="12" cy="9.5" r="2.6"/>',
  plane: '<path d="M10.5 13.5L3 11l1.5-1.5 8 1L17 6a2.1 2.1 0 0 1 3 3l-4.5 4.5 1 8L15 23l-2.5-7.5-3 3V21L8 22.5 6.5 18 2 16.5 3.5 15h2.5z"/>',
  car: '<path d="M4 17h16v-4.5l-2-4.5H6l-2 4.5z"/><path d="M2.5 12.5h19M7 17v2.5M17 17v2.5"/>',
  phoneF: '<path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/>',
  mailF: '<path d="M2 5l10 8 10-8v14H2z"/><path d="M2 5h20l-10 8z" fill-opacity=".85"/>',
  web: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c3 3 3 16 0 19M12 2.5c-3 3-3 16 0 19" stroke="#081330" stroke-width="1.2" fill="none"/>',
};
const Ico = ({ k, style }: { k: string; style?: CSSProperties }) => <svg viewBox="0 0 24 24" style={style} dangerouslySetInnerHTML={{ __html: VI[k] }} />;
const FILLED: CSSProperties = { fill: "var(--ink)", stroke: "none" };

/* ---------- voucher ---------- */

function VoucherShell({ br, t1, t2, sub, children }: { br: Branding; t1: string; t2: string; sub: string; children: ReactNode }) {
  return (
    <div className="a4wrap">
      <div className="a4 hv">
        <div className="hv-top" style={{ backgroundImage: br.cover_url ? `url("${br.cover_url}")` : undefined, backgroundColor: "#0A1734" }}>
          <div className="hv-brand">{br.name}<small>{br.slogan}</small></div>
          {br.logo_url && <img className="hv-logo" src={br.logo_url} alt="Logo" />}
          <div className="hv-title"><b>{t1}</b><span>{t2}</span></div>
          <div className="hv-sub">{sub}</div>
        </div>
        <div className="hv-card">{children}</div>
        <div className="hv-foot">
          {br.logo_white_url ? <img src={br.logo_white_url} alt={br.name} /> : <b style={{ color: "#D9B26A", letterSpacing: ".3em", fontFamily: "Georgia,serif" }}>{br.name}</b>}
          <span className="grow" />
          {br.pills.phone && br.phone && <span className="ct"><Ico k="phoneF" />{br.phone}</span>}
          {br.pills.email && br.email && <span className="ct"><Ico k="mailF" />{br.email}</span>}
          {br.pills.web && br.web && <span className="ct"><Ico k="web" />{br.web}</span>}
        </div>
      </div>
    </div>
  );
}

const Row = ({ i, k, children }: { i: string; k: string; children: ReactNode }) => (
  <div className="hv-row"><Ico k={i} /><span className="k">{k}</span><span className="v">{children}</span></div>
);
const Bullets = ({ text }: { text: string }) => <ul>{text.split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}</ul>;

const isConfirmed = (s: string) => ["confirmed", "travelling", "completed"].includes(s);
function ConfBar({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="hv-conf">
      <Ico k="doc" style={{ width: "2.4em", height: "2.4em", stroke: "var(--ink)", fill: "none", strokeWidth: 1.5 }} />
      <div><div className="k">{label}</div><div className="v">{value}</div></div>
      <span className="div" />
      <span className={ok ? "hv-ok" : "hv-ok hv-wait"}>{ok ? "✓ CONFIRMED" : "AWAITING CONFIRMATION"}</span>
    </div>
  );
}

export function HotelVoucher({ d, cfg }: { d: DocData; cfg: DocConfig }) {
  const b = d.booking, h = d.hotel, t = cfg.texts;
  const name = h?.name ?? b.product_name;
  const logo = h?.logo_url || monogram(name, colorFor(name));
  const photo = h?.voucher_image_url || h?.image_day_url || h?.image_url || "";
  const addr1 = h?.address || "";
  const has = (s?: string | null) => !!s && addr1.toLowerCase().includes(s.toLowerCase());
  const addr2 = [has(h?.city) ? "" : h?.city, has(h?.country) ? "" : h?.country].filter(Boolean).join(" - ");
  const n = nightsBetween(b.start_date, b.end_date);
  return (
    <VoucherShell br={cfg.branding} t1="HOTEL" t2="VOUCHER" sub="YOUR STAY IS CONFIRMED">
      <div className="hv-hotel">
        <div>
          <div className="hv-hn">
            <img className="lg" src={logo} alt="Hotel logo" />
            <div>
              <h4>{name.toUpperCase()}</h4>
              {h?.city && <div className="city">{h.city.toUpperCase()}</div>}
              {!!h?.star_rating && <div className="st">{"★".repeat(h.star_rating)}</div>}
            </div>
          </div>
          {(addr1 || addr2) && <div className="hv-addr"><Ico k="pin" /><span>{addr1}{addr1 && addr2 && <br />}{addr2}</span></div>}
          {h?.description && <div className="hv-desc">{h.description}</div>}
        </div>
        <div className="hv-photo" style={{ backgroundImage: photo ? `url("${photo}")` : undefined, backgroundColor: "#E8EDF5" }} />
      </div>
      <ConfBar label="BOOKING HOTEL CONFIRMATION" value={b.supplier_ref || b.ref} ok={isConfirmed(b.status)} />
      <div className="hv-cols">
        <div>
          <h5>STAY DETAILS</h5>
          <Row i="cal" k="CHECK-IN"><b>{D(b.start_date)}</b>{h?.check_in_time && <> — from {time12(h.check_in_time)}</>}</Row>
          <Row i="cal" k="CHECK-OUT"><b>{D(b.end_date)}</b>{h?.check_out_time && <> — until {time12(h.check_out_time)}</>}</Row>
          <Row i="moon" k="NIGHTS">{plural(n, "Night")}</Row>
          <Row i="bed" k="ROOM TYPE">{snap(b, "room_type", "roomType", "room") || "Standard Room"}{Number(b.product_snapshot?.rooms) > 1 ? ` × ${b.product_snapshot.rooms}` : ""}</Row>
          <Row i="meal" k="MEAL PLAN">{snap(b, "meal_plan", "mealPlan", "meal") || "Room Only"}</Row>
        </div>
        <span className="vl" />
        <div>
          <h5>GUEST DETAILS</h5>
          <Row i="user" k="GUEST NAME">{b.lead_name}</Row>
          <Row i="users" k="GUESTS">{paxText(b)}</Row>
          {t.showHotelContact && (h?.phone || h?.email) && (
            <>
              <div className="hv-rule" />
              <h5>HOTEL CONTACT</h5>
              {h?.phone && <div className="hv-row hv-c"><Ico k="phoneF" style={FILLED} /><span className="v">{h.phone}</span></div>}
              {h?.email && <div className="hv-row hv-c"><Ico k="mailF" style={FILLED} /><span className="v">{h.email}</span></div>}
            </>
          )}
        </div>
      </div>
      <div className="hv-info"><Ico k="clip" /><div><h6>IMPORTANT INFORMATION</h6><Bullets text={t.hotelInfo} /></div></div>
    </VoucherShell>
  );
}

export function TransferVoucher({ d, cfg }: { d: DocData; cfg: DocConfig }) {
  const b = d.booking, br = cfg.branding;
  const flight = [snap(b, "airline"), snap(b, "flight_no", "flight", "flight_number")].filter(Boolean).join(" ");
  const flightRoute = snap(b, "flight_route", "flights");
  const time = time12(snap(b, "flight_time", "arrival_time", "pickup_time", "time_slot", "time"));
  const pickup = snap(b, "pickup", "pickup_point", "from");
  const drop = snap(b, "dropoff", "drop_off", "to", "hotel", "makkah_hotel");
  const vehicle = snap(b, "vehicle", "vehicle_name", "option");
  const bags = snap(b, "bags", "luggage");
  const driver = snap(b, "driver_name", "driver");
  const driverPhone = snap(b, "driver_phone");
  return (
    <VoucherShell br={br} t1="TRANSFER" t2="VOUCHER" sub="YOUR RIDE IS CONFIRMED">
      <ConfBar label="TRANSFER CONFIRMATION" value={b.supplier_ref || b.ref} ok={isConfirmed(b.status)} />
      <div className="hv-cols">
        <div>
          <h5>PICKUP DETAILS</h5>
          {(flight || flightRoute) && <Row i="plane" k="FLIGHT"><b>{flight || flightRoute}</b>{flight && flightRoute && <> — {flightRoute}</>}</Row>}
          <Row i="cal" k={flight ? "ARRIVAL" : "PICKUP DATE"}><b>{D(b.start_date)}</b>{time && <> — {time}</>}</Row>
          <Row i="pin" k="PICKUP">{pickup || "Shared before travel"}</Row>
          <Row i="pin" k="DROP-OFF">{drop || "As booked"}</Row>
          <Row i="car" k="VEHICLE">{vehicle || b.product_name}</Row>
        </div>
        <span className="vl" />
        <div>
          <h5>GUEST DETAILS</h5>
          <Row i="user" k="LEAD GUEST">{b.lead_name}</Row>
          <Row i="users" k="PASSENGERS">{paxText(b)}{bags ? ` · ${bags} Bags` : ""}</Row>
          <div className="hv-rule" />
          <h5>DRIVER</h5>
          <div className="hv-row hv-c"><Ico k="user" /><span className="v">{driver || "Shared by WhatsApp 24 hours before pickup"}</span></div>
          <div className="hv-row hv-c"><Ico k="phoneF" style={FILLED} /><span className="v">{driverPhone || `${br.phone} (24/7)`}</span></div>
        </div>
      </div>
      <div className="hv-info"><Ico k="clip" /><div><h6>IMPORTANT INFORMATION</h6><Bullets text={cfg.texts.transferInfo} /></div></div>
    </VoucherShell>
  );
}

/* ---------- letterhead documents ---------- */

type LhKey = keyof Branding["letterhead_on"];
export function Letterhead({ br, which, children }: { br: Branding; which: LhKey; children: ReactNode }) {
  const on = br.letterhead_on[which];
  const side = `${(br.lh_side_mm / 2.1).toFixed(3)}cqw`;
  return (
    <div className="a4wrap">
      <div className="a4 lh">
        {on && br.lh_header_url && <img className="lh-h" src={br.lh_header_url} alt="Document header" />}
        <div className="body" style={{ padding: `${(br.lh_space_mm / 2.1).toFixed(3)}cqw ${side}` }}>{children}</div>
        {on && br.lh_footer_url && <img className="lh-f" src={br.lh_footer_url} alt="Document footer" />}
      </div>
    </div>
  );
}

function DocHead({ title, kv }: { title: string; kv: [string, ReactNode][] }) {
  return (
    <div className="lh-head">
      <div className="lh-title">{title}</div>
      <table className="lh-kv"><tbody>{kv.map(([k, v]) => <tr key={k}><td className="muted">{k}</td><td>{v}</td></tr>)}</tbody></table>
    </div>
  );
}
const Cap = ({ children }: { children: ReactNode }) => <div className="lh-cap">{children}</div>;
const R = { textAlign: "right" } as const;

export function InvoiceDoc({ d, cfg }: { d: DocData; cfg: DocConfig }) {
  const b = d.booking, cur = b.currency_code || "PKR";
  const n = nightsBetween(b.start_date, b.end_date);
  const isHotel = b.product_type === "hotel";
  const detail = isHotel ? [snap(b, "room_type"), snap(b, "meal_plan")].filter(Boolean).join(" · ") : Object.entries(b.product_snapshot ?? {}).filter(([, v]) => typeof v === "string").slice(0, 2).map(([, v]) => v).join(" · ") || paxText(b);
  const base = b.base_amount || Math.max(0, b.total_amount - b.tax_amount - b.fee_amount + b.discount_amount);
  const qty = isHotel ? n : 1;
  const balance = b.total_amount - b.paid_amount;
  const paid = balance <= 0 && b.total_amount > 0;
  const bank = cfg.bank;
  return (
    <Letterhead br={cfg.branding} which="invoice">
      <DocHead title="INVOICE" kv={[["Invoice no.", docNumber("INV", b.ref)], ["Date", today()], ["Booking", b.ref], ["Due", paid ? "Paid" : b.payment_due_at ? D(b.payment_due_at) : "Before travel"]]} />
      <div className="lh-2">
        <div><Cap>BILL TO</Cap><b style={{ fontSize: "1.15em" }}>{b.lead_name}</b><br />{b.lead_phone}{b.lead_email && <><br />{b.lead_email}</>}</div>
        <div><Cap>TRAVEL</Cap><b>{b.product_name}</b><br />{D(b.start_date)}{b.end_date && b.end_date !== b.start_date ? ` to ${D(b.end_date)}` : ""}<br />{paxText(b)}</div>
      </div>
      <table>
        <thead><tr><th>Description</th><th style={R}>Qty</th><th style={R}>Rate ({cur})</th><th style={R}>Amount ({cur})</th></tr></thead>
        <tbody>
          <tr><td><b>{b.product_name}</b>{detail && <><br /><span className="muted">{detail}</span></>}</td><td style={R}>{isHotel ? plural(n, "night") : 1}</td><td style={R}>{n0(base / qty)}</td><td style={R}>{n0(base)}</td></tr>
          {b.tax_amount > 0 && <tr><td>Taxes and fees</td><td style={R}>1</td><td style={R}>{n0(b.tax_amount)}</td><td style={R}>{n0(b.tax_amount)}</td></tr>}
          {b.fee_amount > 0 && <tr><td>Service fee</td><td style={R}>1</td><td style={R}>{n0(b.fee_amount)}</td><td style={R}>{n0(b.fee_amount)}</td></tr>}
          {b.discount_amount > 0 && <tr><td>Discount</td><td style={R}>1</td><td style={R}>−{n0(b.discount_amount)}</td><td style={R}>−{n0(b.discount_amount)}</td></tr>}
        </tbody>
      </table>
      <div className="lh-tot">
        <div className="tint" style={{ flex: 1 }}>
          {bank ? (
            <><b>Pay by bank transfer</b><br />{bank.bank_name} · {bank.account_title}<br />
              <span className="lh-mono">{bank.iban || bank.account_no}</span><br /><span className="muted">Use {b.ref} as the payment reference.</span></>
          ) : (
            <><b>How to pay</b><br />Call or WhatsApp {cfg.branding.phone} for bank details.<br /><span className="muted">Use {b.ref} as the payment reference.</span></>
          )}
        </div>
        <table style={{ width: "42%" }}>
          <tbody>
            <tr><td>Total</td><td style={{ ...R, fontWeight: 800 }}>{cur} {n0(b.total_amount)}</td></tr>
            <tr><td>Paid</td><td style={{ ...R, color: "var(--ok)" }}>{cur} {n0(b.paid_amount)}</td></tr>
            <tr><td><b>Balance due</b></td><td style={{ ...R, fontWeight: 800, fontSize: "1.2em" }}>{cur} {n0(Math.max(0, balance))}</td></tr>
          </tbody>
        </table>
      </div>
      {paid && <div className="lh-stamp">PAID</div>}
      <div className="muted lh-terms">{cfg.texts.invoiceTerms}</div>
    </Letterhead>
  );
}

export function QuotationDoc({ q, cfg }: { q: Quote; cfg: DocConfig }) {
  const cur = q.currency_code || "PKR";
  const has2 = !!q.col2_label.trim();
  return (
    <Letterhead br={cfg.branding} which="quotation">
      <DocHead title="QUOTATION" kv={[["Quote no.", q.number || "Not saved yet"], ["Date", q.created_at ? D(q.created_at) : today()], ["Valid until", q.valid_until ? D(q.valid_until) : "–"], ...(q.created_by_name ? [["Prepared by", q.created_by_name] as [string, string]] : [])]} />
      <div><Cap>PREPARED FOR</Cap><b style={{ fontSize: "1.15em" }}>{q.customer_name || "Guest name"}</b><br />{[q.customer_phone, q.summary].filter(Boolean).join(" · ")}</div>
      <table>
        <thead><tr><th>Option</th><th>{q.col1_label || "Details"}</th>{has2 && <th>{q.col2_label}</th>}<th style={R}>{q.price_label} ({cur})</th></tr></thead>
        <tbody>
          {q.items.map((it, i) => (
            <tr key={i}><td><b>{it.title}</b></td><td>{it.details}</td>{has2 && <td>{it.details2}</td>}<td style={{ ...R, fontWeight: 800 }}>{n0(it.price)}</td></tr>
          ))}
        </tbody>
      </table>
      {q.included.trim() && <div className="tint"><b>Included{q.items.length > 1 ? " in every option" : ""}</b><br />{q.included}</div>}
      <div className="muted lh-terms">{cfg.texts.quoteTerms}</div>
    </Letterhead>
  );
}

export type VisaExtra = { to: string; subject: string };
export function visaDefaults(d: DocData): VisaExtra {
  const country = d.destination?.country || "";
  const names = (d.travellers.length ? d.travellers : [{ title: null, full_name: d.booking.lead_name }]).map((t) => `${t.title ? t.title + " " : ""}${t.full_name}`);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  return { to: `The Visa Section\nEmbassy of ${country || "[country]"}\nIslamabad`, subject: `Tourist visa for ${list}` };
}

export function VisaLetterDoc({ d, cfg, extra }: { d: DocData; cfg: DocConfig; extra: VisaExtra }) {
  const b = d.booking, br = cfg.branding;
  const vars = {
    destination: [d.destination?.city, d.destination?.country].filter(Boolean).join(", ") || b.product_name,
    start_date: longDate(new Date(b.start_date + "T00:00:00Z")), end_date: b.end_date ? longDate(new Date(b.end_date + "T00:00:00Z")) : "",
    hotel: d.hotel?.name || b.product_name, guest_name: b.lead_name, booking_ref: b.ref, product_name: b.product_name,
  };
  const people = d.travellers.length ? d.travellers : [{ id: "lead", full_name: b.lead_name, passport_no: null, title: null } as DocTraveller];
  const range = `${D(b.start_date).slice(0, 6)} to ${D(b.end_date || b.start_date)}`;
  return (
    <Letterhead br={br} which="visa-letter">
      <div className="lh-2b"><div><b>Ref:</b> {docNumber("VISA", b.ref)}</div><div>{longDate()}</div></div>
      <div>To<br />{extra.to.split("\n").map((l, i) => <span key={i}>{i === 0 ? <b>{l}</b> : l}<br /></span>)}</div>
      <div><b>Subject: {extra.subject}</b></div>
      <div className="lh-paras">{fillVars(cfg.texts.visaBody, vars).split("\n").filter((p) => p.trim()).map((p, i) => <p key={i}>{p}</p>)}</div>
      <table>
        <thead><tr><th>Traveller</th><th>Passport</th><th>Travel dates</th></tr></thead>
        <tbody>{people.map((t) => <tr key={t.id}><td>{t.full_name}</td><td className="lh-mono">{t.passport_no || "–"}</td><td>{range}</td></tr>)}</tbody>
      </table>
      <div className="lh-sign">
        <div>Yours sincerely,<br /><br /><br /><b>{cfg.texts.signatory}</b><br />{String(cfg.business.legal_name || "Sky Holidays (Pvt) Ltd")}</div>
        {br.stamp_url ? <img src={br.stamp_url} alt="Company stamp" className="lh-stampimg" /> : <div className="lh-stampph">Company stamp<br />and signature</div>}
      </div>
    </Letterhead>
  );
}

const methodText = (p: DocPayment) => {
  const m = { bank: "bank transfer", card: "card", wallet: "mobile wallet", cash: "cash" }[p.method] ?? p.method;
  return p.provider ? `${p.provider} (${m})` : m;
};

export function ReceiptDoc({ d, cfg, payment }: { d: DocData; cfg: DocConfig; payment: DocPayment | null }) {
  const b = d.booking, br = cfg.branding;
  const cur = payment?.currency_code || b.currency_code || "PKR";
  const idx = payment ? d.payments.filter((p) => p.kind === "payment").findIndex((p) => p.id === payment.id) + 1 : 0;
  const paidToDate = d.payments.filter((p) => p.kind === "payment" && p.status === "verified" && (!payment || p.received_at <= payment.received_at)).reduce((a, p) => a + Number(p.amount), 0);
  const amount = payment ? Number(payment.amount) : 0;
  return (
    <Letterhead br={br} which="receipt">
      <DocHead title="RECEIPT" kv={[["Receipt no.", docNumber("RCPT", b.ref, idx ? `-${idx}` : "")], ["Date", payment ? D(payment.received_at) : today()], ["Booking", b.ref], ...(payment?.reference ? [["Reference", payment.reference] as [string, string]] : [])]} />
      <div className="tint lh-recv">
        Received with thanks from <b>{b.lead_name}</b> the sum of <b>{cur} {n0(amount)}</b><br />
        <span className="muted">({amountWords(amount)} {CUR_WORD[cur] ?? cur} only)</span><br />
        by <b>{payment ? methodText(payment) : "–"}</b> for <b>{b.product_name}, {D(b.start_date).slice(0, 6)}{b.end_date && b.end_date !== b.start_date ? ` to ${D(b.end_date)}` : D(b.start_date).slice(6)}</b>.
      </div>
      <table>
        <tbody>
          <tr><td>Booking total</td><td style={R}>{cur} {n0(b.total_amount)}</td></tr>
          <tr><td>Paid to date</td><td style={R}>{cur} {n0(paidToDate)}</td></tr>
          <tr><td><b>Balance</b></td><td style={R}><b>{cur} {n0(Math.max(0, b.total_amount - paidToDate))}</b></td></tr>
        </tbody>
      </table>
      {cfg.texts.receiptNote && <div className="muted">{cfg.texts.receiptNote}</div>}
      <div className="lh-sign" style={{ justifyContent: "flex-end", gap: "3em" }}>
        {br.stamp_url && <img src={br.stamp_url} alt="Company stamp" className="lh-stampimg" />}
        <div style={{ textAlign: "center" }}><div className="lh-sigline" />Authorised signature<br /><span className="muted">{cfg.texts.signatory}</span></div>
      </div>
    </Letterhead>
  );
}

/* ---------- sample data for previews (Branding tab, empty systems) ---------- */

export const SAMPLE_DOC: DocData = {
  booking: {
    id: "sample", ref: "SKY-26-04790", product_type: "hotel", product_name: "Ibis Dubai Al Rigga", product_snapshot: { room_type: "Standard Room", meal_plan: "Room Only" },
    status: "confirmed", payment_status: "paid", start_date: "2026-09-13", end_date: "2026-09-25", adults: 3, children: 1, infants: 0,
    lead_name: "Saad Nadeem", lead_email: "saad@example.com", lead_phone: "+92 300 1234 567", currency_code: "PKR",
    base_amount: 260000, tax_amount: 20800, fee_amount: 9200, discount_amount: 0, total_amount: 290000, paid_amount: 290000,
    supplier_ref: "6685AIC05944433", payment_due_at: null, cancellation_policy: null, created_at: "2026-09-01T10:00:00Z",
  },
  travellers: [],
  payments: [],
  hotel: {
    id: "sample", slug: "ibis-dubai-al-rigga", name: "Ibis Dubai Al Rigga", star_rating: 2, address: "Al Rigga Rd - Al Muraqqabat, Deira",
    description: "Ibis Dubai Al Rigga hotel is a great choice for both business and leisure travelers. Choose from standard double room or twin bed, designed to suit your needs and ensuring a relaxing, value for money experience.",
    phone: "+971 4 206 8100", email: "h6685@accor.com", logo_url: "/brand/docs/logo.png", voucher_image_url: "/brand/docs/sample-ibis-room.jpg",
    image_day_url: null, image_night_url: null, image_url: null, check_in_time: "14:00", check_out_time: "12:00", city: "Dubai", country: "United Arab Emirates",
  },
  destination: { city: "Dubai", country: "United Arab Emirates" },
};
