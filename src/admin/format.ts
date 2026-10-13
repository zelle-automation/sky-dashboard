// Number, money and date formatting for the dashboard (Asia/Karachi, en-GB style dates).
export const fmt = (n: number | string | null | undefined, digits = 0) =>
  n == null || n === "" ? "–" : Number(n).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const money = (n: number | string | null | undefined, cur = "PKR") => (n == null || n === "" ? "–" : `${cur} ${fmt(n)}`);
export const pkr = (n: number | string | null | undefined) => money(n, "PKR");

const TZ = "Asia/Karachi";
const asDate = (d: string | Date) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T00:00:00Z") : new Date(d));

/** "13 Sep 2026" (dates without time are read as calendar dates, never shifted). */
export const date = (d: string | Date | null | undefined, withYear = true) =>
  !d ? "–" : asDate(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: typeof d === "string" && d.length === 10 ? "UTC" : TZ }).replace("Sept", "Sep");

export const dateTime = (d: string | Date | null | undefined) =>
  !d ? "–" : new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).replace("Sept", "Sep");

/** "12 min ago", "Yesterday", "3 days ago", then a date. */
export function ago(d: string | Date | null | undefined) {
  if (!d) return "–";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return "Yesterday";
  if (s < 604800) return `${Math.floor(s / 86400)} days ago`;
  return date(d);
}

export const nights = (a: string, b: string | null) => (b ? Math.round((asDate(b).getTime() - asDate(a).getTime()) / 86400000) : 0);

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/** Generated stand-in artwork served by /art (used until real photos are uploaded). */
/** Link to a public website page. Empty base when the dashboard and website share one origin. */
export const siteUrl = (path: string) => (process.env.NEXT_PUBLIC_WEBSITE_URL || "").replace(/\/$/, "") + path;

export const artUrl = (kind: string, palette: string, seed: number) => `/art/${kind}-${palette}-${seed}.svg`;

export const slugify = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
