// Labels and pill tones for bookings, payments and enquiries (shared by the Operate pages).
import type { Tone } from "../ui";
import type { IconName } from "../icons";

export type BookingStatus = "pending" | "supplier" | "confirmed" | "travelling" | "completed" | "refund" | "cancelled";
export type PayStatus = "unpaid" | "deposit" | "paid" | "verify" | "refunded";
export type Stage = "new" | "contacted" | "quoted" | "converted" | "closed";
export type ProductType = "hotel" | "excursion" | "package" | "umrah" | "transfer" | "car" | "visa" | "flight" | "other";

export const STATUS: Record<BookingStatus, [string, Tone, boolean?]> = {
  pending: ["Awaiting payment", "warn"], supplier: ["Awaiting supplier", "info"], confirmed: ["Confirmed", "good"],
  travelling: ["Travelling", "sig"], completed: ["Completed", "plain", false], refund: ["Refund pending", "bad"], cancelled: ["Cancelled", "bad"],
};
export const PAY: Record<PayStatus, [string, Tone, boolean?]> = {
  unpaid: ["Unpaid", "bad"], deposit: ["Deposit paid", "warn"], paid: ["Paid", "good"], verify: ["Slip to verify", "sig"], refunded: ["Refunded", "plain", false],
};
export const STAGES: [Stage, string, Tone, boolean?][] = [
  ["new", "New", "sig"], ["contacted", "Contacted", "info"], ["quoted", "Quoted", "warn"], ["converted", "Converted", "good"], ["closed", "Closed", "plain", false],
];
export const stageOf = (s: string) => STAGES.find((x) => x[0] === s) ?? STAGES[0];

export const TYPE_LABEL: Record<ProductType, string> = {
  hotel: "Hotel", excursion: "Excursion", package: "Package", umrah: "Umrah", transfer: "Transfer", car: "Car rental", visa: "Visa", flight: "Flight", other: "Other",
};
export const TYPE_ICON: Record<ProductType, IconName> = {
  hotel: "bed", excursion: "compass", package: "bag", umrah: "moon", transfer: "route", car: "car", visa: "passport", flight: "plane", other: "ticket",
};
export const CHANNELS: [string, string][] = [["website", "Website"], ["whatsapp", "WhatsApp"], ["phone", "Phone"], ["walk-in", "Walk-in"], ["agent", "Agent"], ["email", "Email"]];
export const channelLabel = (c: string | null | undefined) => CHANNELS.find((x) => x[0] === (c ?? "").toLowerCase())?.[1] ?? (c ? c[0].toUpperCase() + c.slice(1) : "–");

export const METHODS: [string, string][] = [["bank", "Bank transfer"], ["card", "Card"], ["wallet", "Mobile wallet"], ["cash", "Cash"]];
export const methodLabel = (m: string | null | undefined) => METHODS.find((x) => x[0] === m)?.[1] ?? m ?? "–";
export const METHOD_ICON: Record<string, IconName> = { bank: "bank", card: "card", wallet: "phone", cash: "wallet" };

export const SERVICES: [string, string][] = [
  ["umrah", "Umrah"], ["hotels", "Hotels"], ["excursions", "Excursions"], ["packages", "Packages"], ["transfers", "Transfers"],
  ["cars", "Car rental"], ["visa", "Visa"], ["flights", "Flights"], ["general", "General"],
];
export const serviceLabel = (s: string) => SERVICES.find((x) => x[0] === s.toLowerCase())?.[1] ?? (s ? s[0].toUpperCase() + s.slice(1) : "–");

/** Snapshot fields asked for in the booking form, per product type (keys match the voucher). */
export const SNAPSHOT_FIELDS: Record<ProductType, [string, string][]> = {
  hotel: [["room_type", "Room type"], ["meal_plan", "Meal plan"], ["rooms", "Rooms"]],
  excursion: [["option", "Option"], ["time_slot", "Time slot"], ["pickup", "Pickup"]],
  package: [["room_sharing", "Room sharing"], ["flights", "Flights"], ["group_leader", "Group leader"]],
  umrah: [["room_sharing", "Room sharing"], ["makkah_hotel", "Makkah hotel"], ["madinah_hotel", "Madinah hotel"], ["flights", "Flights"]],
  transfer: [["pickup", "Pickup"], ["dropoff", "Drop-off"], ["pickup_time", "Pickup time"], ["flight_no", "Flight no."], ["vehicle", "Vehicle"], ["bags", "Bags"]],
  car: [["vehicle", "Vehicle"], ["with_driver", "With driver"], ["pickup", "Pickup"]],
  visa: [["visa_type", "Visa type"], ["entry", "Entry"]],
  flight: [["route", "Route"], ["airline", "Airline"], ["pnr", "PNR"]],
  other: [["description", "Description"]],
};

export const humanKey = (k: string) => {
  for (const list of Object.values(SNAPSHOT_FIELDS)) for (const [key, label] of list) if (key === k) return label;
  const s = k.replace(/_/g, " ");
  return s[0].toUpperCase() + s.slice(1);
};

export const paxText = (a: number, c = 0, i = 0) =>
  [a ? `${a} adult${a > 1 ? "s" : ""}` : "", c ? `${c} child${c > 1 ? "ren" : ""}` : "", i ? `${i} infant${i > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ") || "–";

/** wa.me link with a prefilled message ("+92 300 ..." → 92300...). */
export function waLink(phone: string, text: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "92" + d.slice(1);
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export const productHref = (type: string, id: string | null) =>
  !id ? null : type === "hotel" ? `/admin/hotels/edit/${id}` : type === "excursion" ? `/admin/excursions/edit/${id}` : type === "package" ? `/admin/packages/all?open=${id}`
    : type === "umrah" ? "/admin/umrah/flexible" : type === "transfer" ? "/admin/transfers/airport" : type === "car" ? "/admin/cars/fleet" : type === "visa" ? "/admin/visa" : null;
