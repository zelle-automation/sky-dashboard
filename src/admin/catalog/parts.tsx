"use client";
// Shared pieces of the hotel and excursion screens: the list page, the editor frame
// (sections as rail sub-tabs, side preview, save bar), photo pairs and small inputs.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { sectionOf } from "@/shared/admin-nav";
import { api, uploadFile, useData } from "../api";
import { fmt, pkr } from "../format";
import type { IconName } from "../icons";
import { sectionHref, useCan, useMe, useRailSub } from "../shell";
import { Btn, cx, Empty, ErrorNote, Icon, IconBtn, Input, Loading, PageHead, Pill, SaveBar, Search, Section, useConfirm, useToast } from "../ui";
import type { Check, PhotoPair } from "./model";

export type Kind = "hotels" | "excursions";

/* ---------- small inputs ---------- */

/** Number input that holds `number | null` (empty = null). */
export function Num({ value, onChange, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      {...rest}
    />
  );
}

export function PreNum({ pre, value, onChange, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { pre: ReactNode; value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <div className="inp-pre">
      <span>{pre}</span>
      <input type="number" inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} {...rest} />
    </div>
  );
}

export const statusTone = (s: string) => (s === "published" ? "good" : s === "seasonal" ? "info" : s === "archived" ? "warn" : "plain");
export const statusLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Score({ value, reviews }: { value: number | null; reviews?: number | null }) {
  if (value == null) return <span className="faint">No score</span>;
  return (
    <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
      <span className="score">{Number(value).toFixed(1)}</span>
      {reviews != null && <span className="t2 tab">{fmt(reviews)}</span>}
    </div>
  );
}

export function Meter({ value }: { value: number }) {
  return (
    <div className="row" style={{ flexWrap: "nowrap", gap: 8, minWidth: 96 }}>
      <div className="meter" style={{ flex: 1 }}><i style={{ width: `${value}%` }} /></div>
      <span className="tab t2">{value}%</span>
    </div>
  );
}

/* ---------- list page ---------- */

type HotelRow = { id: string; slug: string | null; name: string; kind: string | null; star_rating: number | null; area: string | null; destination: string | null; status: string; price_from: number | null; rating: number | null; review_count: number | null; rooms: number; thumb: string | null; quality: number; photo_issue: string | null };
type ExcRow = { id: string; slug: string | null; title: string; category: string | null; destination: string | null; status: string; price_from: number | null; price_unit: string; rating: number | null; review_count: number | null; thumb: string | null; duration: string | null; schedule: string; quality: number; photo_issue: string | null };

const TAB_TITLE: Record<string, string> = { published: "Published", draft: "Drafts", photos: "Needs photos", seasonal: "Seasonal" };

export function CatalogList({ kind, tab }: { kind: Kind; tab: string }) {
  const H = kind === "hotels";
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, loading, reload } = useData<(HotelRow | ExcRow)[]>(`/${kind}?tab=${tab}&q=${encodeURIComponent(term)}`);
  const canCreate = useCan(kind, "create");
  const canDelete = useCan(kind, "delete");
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const edit = (id: string) => router.push(`/admin/${kind}/edit/${id}`);

  async function remove(id: string, name: string) {
    const ok = await confirm({ title: `Delete ${name}?`, body: H ? "Its room types, rate plans, prices and reviews are deleted too. Past bookings keep their details." : "Its options and prices are deleted too. Past bookings keep their details.", confirm: "Delete", danger: true });
    if (!ok) return;
    try {
      await api.del(`/${kind}/${id}`);
      toast(`${name} deleted`);
      reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  }

  const title = tab === "all" ? (H ? "Hotels" : "Excursions") : TAB_TITLE[tab] ?? tab;
  return (
    <>
      <PageHead
        eyebrow="Catalogue"
        title={title}
        sub={H ? "Properties, rooms, rate plans, availability and policies. Changes show on the website within a minute." : "Tours, tickets and day trips with time slots, age-band pricing, pickup zones and itineraries."}
      >
        {canCreate && <Btn variant="gold" icon="plus" onClick={() => router.push(`/admin/${kind}/edit/new`)}>{H ? "Add hotel" : "Add excursion"}</Btn>}
      </PageHead>
      <section className="panel">
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="cat-search"><Search value={q} onChange={setQ} placeholder={H ? "Search by name, area or city" : "Search by name, category or city"} /></div>
          <span className="spacer" />
          {data && <span className="faint" style={{ fontSize: 12.5 }}>{data.length} {H ? (data.length === 1 ? "hotel" : "hotels") : data.length === 1 ? "excursion" : "excursions"}</span>}
        </div>
        <ErrorNote error={error} />
        {loading && !data ? <Loading /> : data && data.length === 0 ? (
          <Empty icon={H ? "bed" : "compass"} title={term ? "Nothing matches that search" : tab === "photos" ? "Every hotel has its photos" : "Nothing here yet"}>
            {!term && tab === "all" && canCreate && <span>Add the first one with the button above.</span>}
          </Empty>
        ) : data && (
          <div className="tbl-wrap">
            <table className="cat-list">
              <thead>
                <tr>
                  <th>{H ? "Property" : "Experience"}</th><th>Destination</th><th>{H ? "Type" : "Category"}</th><th>{H ? "Room types" : "Schedule"}</th>
                  <th className="num">From</th><th>Guest score</th><th>Listing quality</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {data.map((x) => {
                  const name = H ? (x as HotelRow).name : (x as ExcRow).title;
                  return (
                    <tr key={x.id} className="click" tabIndex={0} onClick={() => edit(x.id)} onKeyDown={(e) => e.key === "Enter" && edit(x.id)}>
                      <td>
                        <div className="row" style={{ flexWrap: "nowrap" }}>
                          <div className="thumb lg" style={x.thumb ? { backgroundImage: `url("${x.thumb}")` } : { display: "grid", placeItems: "center", color: "var(--faint)" }}>{!x.thumb && <Icon name="image" />}</div>
                          <div style={{ minWidth: 0 }}>
                            <b>{name}</b>
                            <div className="t2">
                              {H ? <>{"★".repeat((x as HotelRow).star_rating ?? 0)}{(x as HotelRow).area ? ` · ${(x as HotelRow).area}` : ""}</> : (x as ExcRow).duration ?? "No duration yet"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{x.destination ?? <span className="faint">Not set</span>}</td>
                      <td>{H ? (x as HotelRow).kind : (x as ExcRow).category}</td>
                      <td>
                        {H ? `${(x as HotelRow).rooms} room type${(x as HotelRow).rooms === 1 ? "" : "s"}` : (x as ExcRow).schedule}
                        {x.photo_issue && tab === "photos" && <div className="t2" style={{ color: "var(--warn)" }}>{x.photo_issue}</div>}
                      </td>
                      <td className="num tab"><b>{x.price_from != null ? pkr(x.price_from) : "–"}</b><div className="t2">{H ? "per night" : (x as ExcRow).price_unit === "per person" ? "per adult" : (x as ExcRow).price_unit}</div></td>
                      <td><Score value={x.rating} reviews={x.review_count} /></td>
                      <td><Meter value={x.quality} /></td>
                      <td><Pill tone={statusTone(x.status)} dot={x.status !== "draft"}>{statusLabel(x.status)}</Pill></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row" style={{ flexWrap: "nowrap", gap: 6 }}>
                          <IconBtn icon="edit" label={`Edit ${name}`} onClick={() => edit(x.id)} />
                          {canDelete && <IconBtn icon="trash" label={`Delete ${name}`} onClick={() => remove(x.id, name)} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* ---------- editor frame ---------- */

export type EdSection = { key: string; label: string; icon: IconName; sub?: string; warn?: string | null; body: ReactNode };

/** Loads `/kind/:id`, keeps a draft copy, tracks unsaved changes and saves (POST for new, PUT otherwise). */
export function useEditorDoc<D extends { id?: string }, M>(kind: Kind, id: string, blank: () => D) {
  const isNew = id === "new";
  const { data, error, loading } = useData<{ doc: D; meta: M }>(isNew ? null : `/${kind}/${id}`);
  const [doc, setDoc] = useState<D | null>(isNew ? blank() : null);
  const [saved, setSaved] = useState<string>(isNew ? JSON.stringify(blank()) : "");
  const [meta, setMeta] = useState<M | null>(null);
  useEffect(() => {
    if (!data) return;
    // Copy the loaded document into the editable draft.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDoc(data.doc); setSaved(JSON.stringify(data.doc)); setMeta(data.meta);
  }, [data]);
  const dirty = !!doc && JSON.stringify(doc) !== saved;
  const set = useCallback(<K extends keyof D>(k: K, v: D[K]) => setDoc((d) => (d ? { ...d, [k]: v } : d)), []);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    addEventListener("beforeunload", h);
    return () => removeEventListener("beforeunload", h);
  }, [dirty]);

  async function save(patch?: Partial<D>) {
    if (!doc) return;
    const body = { ...doc, ...patch };
    setBusy(true);
    try {
      const out = isNew ? await api.post<{ doc: D; meta: M }>(`/${kind}`, body) : await api.put<{ doc: D; meta: M }>(`/${kind}/${id}`, body);
      setDoc(out.doc); setSaved(JSON.stringify(out.doc)); setMeta(out.meta);
      toast(isNew ? "Created" : "Saved");
      if (isNew && out.doc.id) router.replace(`/admin/${kind}/edit/${out.doc.id}`);
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  }
  const reset = () => setDoc(JSON.parse(saved));
  return { doc, setDoc, set, meta, error, loading: loading || (!isNew && !doc), dirty, busy, save, reset, isNew };
}

export function EditorFrame({ kind, eyebrow, title, pills, actions, sections, side, dirty, busy, onSave, onReset }: {
  kind: Kind; eyebrow: ReactNode; title: ReactNode; pills: ReactNode; actions: ReactNode; sections: EdSection[]; side: ReactNode;
  dirty: boolean; busy: boolean; onSave: () => void; onReset: () => void;
}) {
  const me = useMe();
  const s = sectionOf(kind);
  const backHref = (s && sectionHref(me, s)) || "/admin";
  const [current, setCurrent] = useState(sections[0]?.key ?? "");
  const lock = useRef(0);

  const select = useCallback((key: string) => {
    setCurrent(key);
    lock.current = Date.now() + 900;
    document.getElementById(`sec-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const keys = sections.map((x) => x.key).join(",");
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (Date.now() < lock.current) return;
        let cur = keys.split(",")[0];
        for (const k of keys.split(",")) {
          const el = document.getElementById(`sec-${k}`);
          if (el && el.getBoundingClientRect().top < 160) cur = k;
        }
        if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = keys.split(",").at(-1)!;
        setCurrent(cur);
      });
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => { removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [keys]);

  useRailSub({
    back: { href: backHref, label: kind === "hotels" ? "All hotels" : "All excursions" },
    items: sections.map((x) => ({ key: x.key, label: x.label, warn: !!x.warn })),
    current,
    onSelect: select,
  });

  return (
    <>
      <div className="ph">
        <div style={{ minWidth: 0 }}>
          <Link href={backHref} className="btn btn-sm btn-ghost" style={{ marginBottom: 8, textDecoration: "none" }}><Icon name="back" />{kind === "hotels" ? "Hotels" : "Excursions"}</Link>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          <div className="row" style={{ marginTop: 8 }}>{pills}</div>
        </div>
        <div className="row">{actions}</div>
      </div>
      <div className="ed">
        <div className="ed-body">
          {sections.map((x) => (
            <Section key={x.key} id={`sec-${x.key}`} icon={x.icon} title={x.label} sub={x.sub} actions={x.warn ? <Pill tone="warn">{x.warn}</Pill> : undefined}>
              {x.body}
            </Section>
          ))}
          <SaveBar dirty={dirty} busy={busy} onSave={onSave} onReset={onReset} />
        </div>
        <aside className="ed-side">{side}</aside>
      </div>
    </>
  );
}

export function QualityPanel({ checks }: { checks: Check[] }) {
  const pct = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  return (
    <div className="panel" style={{ padding: 16 }}>
      <div className="row" style={{ marginBottom: 10 }}><h3 style={{ margin: 0, flex: 1 }}>Listing quality</h3><b className="tab" style={{ color: "var(--gold)" }}>{pct}%</b></div>
      <div className="meter" style={{ height: 8 }}><i style={{ width: `${pct}%` }} /></div>
      <div className="list" style={{ marginTop: 8 }}>
        {checks.map((c) => (
          <button type="button" key={c.section} className="li" style={{ fontSize: 12.5, width: "100%", textAlign: "left" }} onClick={() => document.getElementById(`sec-${c.section}`)?.scrollIntoView({ behavior: "smooth" })}>
            <span style={{ color: c.ok ? "var(--good)" : "var(--warn)", display: "inline-flex" }}><Icon name={c.ok ? "check" : "clock"} /></span>
            <span className="grow">{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- photos ---------- */

function useUpload(folder: string) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const up = useCallback(async (files: File[]) => {
    setBusy(true);
    try {
      const out: string[] = [];
      for (const f of files) out.push((await uploadFile(f, folder)).url);
      return out;
    } catch (e) {
      toast((e as Error).message, "bad");
      return [];
    } finally {
      setBusy(false);
    }
  }, [folder, toast]);
  return { up, busy };
}

/** Logo / voucher photo row: preview, label and a Replace button. */
export function UpRow({ title, hint, value, onChange, folder, contain }: { title: string; hint: string; value: string | null; onChange: (v: string | null) => void; folder: string; contain?: boolean }) {
  const id = useId();
  const { up, busy } = useUpload(folder);
  return (
    <div className="up-row">
      <div className="prv" style={{ backgroundImage: value ? `url("${value}")` : undefined, backgroundSize: contain ? "contain" : "cover", backgroundColor: contain ? "#fff" : undefined, display: "grid", placeItems: "center", color: "var(--faint)" }}>
        {!value && <Icon name="image" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: 13 }}>{title}</b>
        <div className="t2" style={{ color: "var(--muted)", fontSize: 12 }}>{hint}</div>
      </div>
      <label htmlFor={id} className="btn btn-sm" style={{ cursor: "pointer" }}>{busy ? <span className="spin" /> : <Icon name="upload" />}{value ? "Replace" : "Upload"}</label>
      {value && <IconBtn icon="trash" label={`Remove ${title.toLowerCase()}`} onClick={() => onChange(null)} />}
      <input id={id} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { const [u] = await up([f]); if (u) onChange(u); } }} />
    </div>
  );
}

/** Day/evening photo pairs. The first pair is the cover (image_day_url / image_night_url on the site). */
export function PhotoGrid({ value, onChange, folder }: { value: PhotoPair[]; onChange: (v: PhotoPair[]) => void; folder: string }) {
  const dropId = useId();
  const { up, busy } = useUpload(folder);
  const drag = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const setAt = (i: number, p: Partial<PhotoPair>) => onChange(value.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= value.length) return;
    const next = [...value];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };
  async function add(files: FileList | null) {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    const urls = await up(list);
    onChange([...value, ...urls.map((u, i) => ({ day: u, night: null, tag: list[i].name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 40) }))]);
  }
  async function replace(i: number, side: "day" | "night", f: File | undefined) {
    if (!f) return;
    const [u] = await up([f]);
    if (u) setAt(i, { [side]: u });
  }
  return (
    <div className="ph-grid">
      {value.map((p, i) => (
        <div
          key={p.day + i}
          className={cx("ph-item", over === i && "ph-over")}
          draggable
          onDragStart={() => { drag.current = i; }}
          onDragOver={(e) => { e.preventDefault(); setOver(i); }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => { e.preventDefault(); setOver(null); if (drag.current != null) move(drag.current, i); drag.current = null; }}
        >
          {i === 0 && <span className="ph-cover">Cover</span>}
          <div className="ph-pair">
            <label style={{ backgroundImage: `url("${p.day}")`, backgroundSize: "cover", backgroundPosition: "center", position: "relative", cursor: "pointer" }} title="Replace day photo">
              <span className="ph-lbl">Day</span>
              <input type="file" accept="image/*" hidden onChange={(e) => { replace(i, "day", e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {p.night ? (
              <label style={{ backgroundImage: `url("${p.night}")`, backgroundSize: "cover", backgroundPosition: "center", position: "relative", cursor: "pointer" }} title="Replace evening photo">
                <span className="ph-lbl">Evening</span>
                <input type="file" accept="image/*" hidden onChange={(e) => { replace(i, "night", e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            ) : (
              <label className="ph-miss">
                Add evening
                <input type="file" accept="image/*" hidden onChange={(e) => { replace(i, "night", e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            )}
          </div>
          <div className="ph-meta">
            <span style={{ color: "var(--faint)", cursor: "grab", display: "inline-flex" }} title="Drag to reorder"><Icon name="grip" /></span>
            <input className="ph-tag" value={p.tag} aria-label="Photo label" placeholder="Label" onChange={(e) => setAt(i, { tag: e.target.value })} />
            {i > 0 && <button type="button" className="icon-btn ph-btn" aria-label="Make cover" title="Make cover" onClick={() => move(i, 0)}><Icon name="star" /></button>}
            <button type="button" className="icon-btn ph-btn" aria-label="Remove photo" title="Remove photo" onClick={() => onChange(value.filter((_, j) => j !== i))}><Icon name="trash" /></button>
          </div>
        </div>
      ))}
      <label htmlFor={dropId} className="drop" style={{ cursor: "pointer" }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (drag.current == null) add(e.dataTransfer.files); }}>
        {busy ? <span className="spin" /> : <Icon name="upload" />}
        <b>Drop photos here</b>
        <span>JPG or WebP, 1600 px wide. Add a day and an evening shot.</span>
      </label>
      <input id={dropId} type="file" multiple accept="image/*" hidden onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

/** Small thumbnails strip with add/remove for room photos. */
export function ThumbStrip({ value, onChange, folder }: { value: string[]; onChange: (v: string[]) => void; folder: string }) {
  const id = useId();
  const { up, busy } = useUpload(folder);
  return (
    <div className="row" style={{ gap: 8 }}>
      {value.map((u, i) => (
        <div key={u + i} className="thumb lg" style={{ backgroundImage: `url("${u}")`, position: "relative" }}>
          <button type="button" className="thumb-x" aria-label="Remove photo" onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <label htmlFor={id} className="thumb lg drop" style={{ minHeight: 0, padding: 0, cursor: "pointer" }} title="Add photos">
        {busy ? <span className="spin" /> : <Icon name="plus" />}
      </label>
      <input id={id} type="file" multiple accept="image/*" hidden onChange={async (e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; const us = await up(fs); if (us.length) onChange([...value, ...us]); }} />
    </div>
  );
}

/** Destinations for the editors' selects. */
export function useDestinations(kind: Kind) {
  const { data } = useData<{ destinations: { id: string; name: string; slug: string; country: string }[] }>(`/${kind}/options`);
  return useMemo(() => data?.destinations ?? [], [data]);
}
