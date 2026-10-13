"use client";
// 14-night availability grid per room type: price, rooms left and stop-sell, with a bulk editor.
import { useMemo, useState } from "react";
import { api, useData } from "../api";
import { date, fmt } from "../format";
import { Btn, Check, cx, ErrorNote, Field, Icon, Loading, Modal, Select, useToast } from "../ui";
import { Num } from "./parts";

type Cell = { date: string; weekend: boolean; price: number; custom_price: boolean; rooms_left: number; stop_sell: boolean };
type Grid = { from: string; dates: string[]; weekend_uplift: number; rooms: { id: string; name: string; units: number; base_price: number; cells: Cell[] }[] };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const todayPk = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
const short = (n: number) => (n >= 100000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Bulk = { room_ids: string[]; from: string; to: string; weekdays: number[]; price: number | null; priceMode: "keep" | "set" | "auto"; left: number | null; leftMode: "keep" | "set"; stop: "keep" | "open" | "close" };

export function AvailabilityGrid({ hotelId, canEdit, version, currency = "PKR" }: { hotelId: string; canEdit: boolean; version: string; currency?: string }) {
  const [from, setFrom] = useState(todayPk());
  const { data, error, loading, reload } = useData<Grid>(`/hotels/${hotelId}/availability?from=${from}&days=14&v=${encodeURIComponent(version)}`);
  const [bulk, setBulk] = useState<Bulk | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  const open = (b: Partial<Bulk>) => {
    if (!data) return;
    setErr(null);
    setBulk({ room_ids: data.rooms.map((r) => r.id), from: data.from, to: addDays(data.from, 13), weekdays: [0, 1, 2, 3, 4, 5, 6], price: null, priceMode: "keep", left: null, leftMode: "keep", stop: "keep", ...b });
  };

  async function apply() {
    if (!bulk) return;
    setBusy(true); setErr(null);
    try {
      const body: Record<string, unknown> = { room_ids: bulk.room_ids, from: bulk.from, to: bulk.to };
      if (bulk.weekdays.length < 7) body.weekdays = bulk.weekdays;
      if (bulk.priceMode === "set") { if (bulk.price == null) throw new Error("Enter a price or keep the current one"); body.price = bulk.price; }
      if (bulk.priceMode === "auto") body.price = null;
      if (bulk.leftMode === "set") { if (bulk.left == null) throw new Error("Enter rooms left or keep the current number"); body.rooms_left = bulk.left; }
      if (bulk.stop !== "keep") body.stop_sell = bulk.stop === "close";
      if (bulk.priceMode === "keep" && bulk.leftMode === "keep" && bulk.stop === "keep") throw new Error("Choose something to change");
      if (!bulk.room_ids.length) throw new Error("Pick at least one room type");
      const out = await api.put<{ nights: number }>(`/hotels/${hotelId}/availability`, body);
      toast(`Updated ${out.nights} night${out.nights === 1 ? "" : "s"}`);
      setBulk(null);
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const months = useMemo(() => {
    if (!data) return "";
    const a = date(data.dates[0], false), b = date(data.dates.at(-1)!, false);
    return `${a} – ${b}`;
  }, [data]);

  if (error) return <ErrorNote error={error} />;
  if (!data) return loading ? <Loading /> : null;
  if (!data.rooms.length) return <div className="faint" style={{ fontSize: 13 }}>Add a room type and save to manage nightly prices.</div>;

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 6 }}>
          <Btn size="sm" variant="ghost" icon="back" aria-label="Previous 14 nights" onClick={() => setFrom(addDays(from, -14))} disabled={from <= todayPk()} />
          <Btn size="sm" onClick={() => setFrom(todayPk())}>Today</Btn>
          <Btn size="sm" variant="ghost" aria-label="Next 14 nights" onClick={() => setFrom(addDays(from, 14))}><Icon name="chev" /></Btn>
          <b style={{ fontSize: 13 }} className="tab">{months}</b>
        </div>
        {canEdit && <Btn size="sm" icon="edit" onClick={() => open({})}>Bulk edit dates</Btn>}
        {canEdit && <Btn size="sm" icon="lock" onClick={() => open({ stop: "close" })}>Stop sell</Btn>}
        <span className="spacer" />
        <div className="legend">
          <span><i style={{ background: "var(--gold-soft)" }} />Weekend{data.weekend_uplift ? ` +${fmt(data.weekend_uplift)}%` : ""}</span>
          <span><i style={{ background: "var(--warn-soft)" }} />2 or fewer left</span>
          <span><i style={{ background: "var(--bad-soft)" }} />Closed</span>
        </div>
      </div>
      <div className="tbl-wrap">
        <div className="cal" style={{ gridTemplateColumns: "118px repeat(14,minmax(48px,1fr))" }}>
          <div className="c hd" />
          {data.dates.map((d) => {
            const dt = new Date(d + "T00:00:00Z");
            return <div key={d} className="c hd">{WD[dt.getUTCDay()]}<br />{dt.getUTCDate()}</div>;
          })}
          {data.rooms.map((rm) => (
            <div key={rm.id} style={{ display: "contents" }}>
              <div className="c rm" title={rm.name}><span className="trunc">{rm.name}</span></div>
              {rm.cells.map((c) => (
                <button
                  key={c.date}
                  type="button"
                  className={cx("c", c.stop_sell ? "stop" : c.rooms_left <= 2 ? "low" : c.weekend ? "we" : "", "cal-btn")}
                  disabled={!canEdit}
                  title={`${rm.name}, ${date(c.date)}: ${currency} ${fmt(c.price)}${c.custom_price ? " (set by hand)" : ""}, ${c.rooms_left} left${c.stop_sell ? ", stop sell" : ""}`}
                  onClick={() => open({ room_ids: [rm.id], from: c.date, to: c.date, price: c.price, priceMode: "keep", left: c.rooms_left, stop: "keep" })}
                >
                  <b className="tab">{c.stop_sell ? "Closed" : short(c.price)}{c.custom_price && !c.stop_sell && <sup style={{ color: "var(--gold)" }}>•</sup>}</b>
                  <span className="tab">{c.stop_sell ? "stop sell" : `${c.rooms_left} left`}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="faint" style={{ fontSize: 12, margin: "10px 0 0" }}>Prices are per night in {currency} before rate plan changes. A dot marks a price set by hand; other nights follow the room’s base price and weekend uplift.</p>

      <Modal
        open={!!bulk}
        onClose={() => setBulk(null)}
        title={bulk && bulk.from === bulk.to && bulk.room_ids.length === 1 ? `${data.rooms.find((r) => r.id === bulk.room_ids[0])?.name} · ${date(bulk.from)}` : "Change dates"}
        wide
        foot={<><Btn variant="ghost" onClick={() => setBulk(null)}>Cancel</Btn><Btn variant="gold" icon="check" busy={busy} onClick={apply}>Apply</Btn></>}
      >
        {bulk && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Room types">
              <div className="row" style={{ gap: "4px 16px" }}>
                {data.rooms.map((r) => (
                  <Check key={r.id} label={r.name} checked={bulk.room_ids.includes(r.id)} onChange={(v) => setBulk({ ...bulk, room_ids: v ? [...bulk.room_ids, r.id] : bulk.room_ids.filter((x) => x !== r.id) })} />
                ))}
              </div>
            </Field>
            <div className="f-grid">
              <Field label="From night"><input className="inp" type="date" value={bulk.from} onChange={(e) => setBulk({ ...bulk, from: e.target.value, to: e.target.value > bulk.to ? e.target.value : bulk.to })} /></Field>
              <Field label="To night (included)"><input className="inp" type="date" value={bulk.to} min={bulk.from} onChange={(e) => setBulk({ ...bulk, to: e.target.value })} /></Field>
            </div>
            {bulk.from !== bulk.to && (
              <Field label="Only on">
                <div className="chips">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <button key={d} type="button" className="chip" aria-pressed={bulk.weekdays.includes(d)} onClick={() => setBulk({ ...bulk, weekdays: bulk.weekdays.includes(d) ? bulk.weekdays.filter((x) => x !== d) : [...bulk.weekdays, d] })}>{WD[d]}</button>
                  ))}
                </div>
              </Field>
            )}
            <div className="f-grid c3">
              <Field label="Price per night">
                <Select value={bulk.priceMode} onChange={(e) => setBulk({ ...bulk, priceMode: e.target.value as Bulk["priceMode"] })} options={[{ value: "keep", label: "Keep as is" }, { value: "set", label: "Set a price" }, { value: "auto", label: "Back to base price" }]} />
              </Field>
              <Field label={`Price (${currency})`}><Num value={bulk.priceMode === "auto" ? null : bulk.price} placeholder={bulk.priceMode === "auto" ? "Base price" : ""} onChange={(v) => setBulk({ ...bulk, price: v, priceMode: "set" })} min={0} /></Field>
              <Field label="Rooms left">
                <Num value={bulk.leftMode === "set" ? bulk.left : null} placeholder="Keep as is" min={0} onChange={(v) => setBulk({ ...bulk, left: v, leftMode: v == null ? "keep" : "set" })} />
              </Field>
            </div>
            <Field label="Selling">
              <Select value={bulk.stop} onChange={(e) => setBulk({ ...bulk, stop: e.target.value as Bulk["stop"] })} options={[{ value: "keep", label: "Keep as is" }, { value: "open", label: "Open for sale" }, { value: "close", label: "Stop sell (closed)" }]} />
            </Field>
            <ErrorNote error={err} />
          </div>
        )}
      </Modal>
    </>
  );
}
