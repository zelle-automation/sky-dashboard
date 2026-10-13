"use client";
// Homepage → Hero & offer and Sections (order and show/hide). Saved to settings "homepage",
// which the website reads from GET /api/site.
import { useState } from "react";
import { useCan } from "@/admin/shell";
import { Btn, ErrorNote, Field, Icon, IconBtn, ImageUpload, Input, Loading, PageHead, Panel, SaveBar, Select, Switch, Textarea, Check, useToast } from "@/admin/ui";
import { useSettingsForm } from "./Settings";

const TABS = ["flights", "hotels", "packages", "excursions", "umrah", "transfers", "cars", "visa"] as const;
const TAB_LABEL: Record<string, string> = { flights: "Flights", hotels: "Hotels", packages: "Packages", excursions: "Excursions", umrah: "Umrah", transfers: "Transfers", cars: "Car rental", visa: "Visa" };
type Hero = {
  eyebrow: string; headline: string; sub: string; cta_label: string; cta_link: string; cta2_label: string; cta2_link: string;
  image_day_url: string; image_night_url: string; search_default: string; search_tabs: Record<string, boolean>;
};
type Offer = { enabled: boolean; badge: string; title: string; text: string; link: string; until: string };
type Home = { hero: Hero; offer: Offer; sections: { key: string; enabled: boolean }[]; labels: Record<string, string>; packages: { slug: string; title: string }[] };

const Preview = () => <a className="btn" href="/" target="_blank" rel="noreferrer"><Icon name="eye" />Preview website</a>;

export function HeroTab() {
  const f = useSettingsForm<Home>("/homepage", "/homepage/hero");
  const canEdit = useCan("homepage.hero", "edit");
  if (f.loadError) return <ErrorNote error={f.loadError} />;
  if (!f.v) return <Loading />;
  const h = f.v.hero, o = f.v.offer;
  const setH = (p: Partial<Hero>) => f.setV({ ...f.v!, hero: { ...h, ...p } });
  const setO = (p: Partial<Offer>) => f.setV({ ...f.v!, offer: { ...o, ...p } });
  const save = async () => {
    await f.save({ hero: h, offer: o }, "Published to the website");
  };
  const linkOpts = [
    { value: "/umrah", label: "Umrah page" }, { value: "/packages", label: "All packages" }, { value: "/destinations", label: "Destinations" }, { value: "/visa", label: "Visa services" },
    ...f.v.packages.map((p) => ({ value: `/packages/${p.slug}`, label: `Package: ${p.title}` })),
  ];
  if (o.link && !linkOpts.some((l) => l.value === o.link)) linkOpts.unshift({ value: o.link, label: o.link });
  return (
    <>
      <PageHead eyebrow="Homepage" title="Hero & offer" sub="The big image, headline and seasonal offer at the top of the homepage.">
        <Preview />
        {canEdit && <Btn variant="gold" icon="check" busy={f.busy} disabled={!f.dirty} onClick={save}>Publish</Btn>}
      </PageHead>
      <ErrorNote error={f.err} />
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="grid g-2" style={{ alignItems: "start" }}>
          <Panel title="Hero">
            <div className="grid g-2" style={{ marginBottom: 14, gap: 12 }}>
              <Field label="Day photo · light theme"><ImageUpload value={h.image_day_url} onChange={(u) => setH({ image_day_url: u ?? "" })} folder="branding" aspect="16/9" /></Field>
              <Field label="Evening photo · dark theme"><ImageUpload value={h.image_night_url} onChange={(u) => setH({ image_night_url: u ?? "" })} folder="branding" aspect="16/9" /></Field>
            </div>
            <div className="f-grid">
              <Field label="Eyebrow" className="span-all"><Input value={h.eyebrow} onChange={(e) => setH({ eyebrow: e.target.value })} /></Field>
              <Field label="Headline" className="span-all" hint="The last word is shown in gold italics on the website."><Input value={h.headline} onChange={(e) => setH({ headline: e.target.value })} /></Field>
              <Field label="Text under headline" className="span-all"><Textarea rows={3} value={h.sub} onChange={(e) => setH({ sub: e.target.value })} /></Field>
              <Field label="Main button"><Input value={h.cta_label} onChange={(e) => setH({ cta_label: e.target.value })} /></Field>
              <Field label="Main button link"><Input value={h.cta_link} onChange={(e) => setH({ cta_link: e.target.value })} placeholder="/destinations" /></Field>
              <Field label="Second button"><Input value={h.cta2_label} onChange={(e) => setH({ cta2_label: e.target.value })} /></Field>
              <Field label="Second button link"><Input value={h.cta2_link} onChange={(e) => setH({ cta2_link: e.target.value })} placeholder="/packages" /></Field>
            </div>
          </Panel>
          <div className="grid" style={{ alignContent: "start" }}>
            <Panel title="Seasonal offer" actions={<Switch checked={o.enabled} onChange={(v) => setO({ enabled: v })} label="Show the seasonal offer" disabled={!canEdit} />}>
              <div className="f-grid" style={o.enabled ? undefined : { opacity: 0.5 }}>
                <Field label="Label"><Input value={o.badge} onChange={(e) => setO({ badge: e.target.value })} /></Field>
                <Field label="Title"><Input value={o.title} onChange={(e) => setO({ title: e.target.value })} /></Field>
                <Field label="Text" className="span-all"><Textarea rows={2} value={o.text} onChange={(e) => setO({ text: e.target.value })} /></Field>
                <Field label="Links to"><Select value={o.link} onChange={(e) => setO({ link: e.target.value })} options={linkOpts} /></Field>
                <Field label="Show until" hint="Leave empty to keep it up"><Input type="date" value={o.until} onChange={(e) => setO({ until: e.target.value })} /></Field>
              </div>
            </Panel>
            <Panel title="Search box">
              <Field label="Search opens on">
                <Select value={h.search_default} onChange={(e) => setH({ search_default: e.target.value })} options={TABS.filter((t) => h.search_tabs[t]).map((t) => ({ value: t, label: TAB_LABEL[t] }))} />
              </Field>
              <div className="lab muted" style={{ fontSize: 11.5, fontWeight: 700, margin: "14px 0 4px" }}>Tabs shown</div>
              <div className="f-grid c4" style={{ gap: 4 }}>
                {TABS.map((t) => <Check key={t} label={TAB_LABEL[t]} checked={!!h.search_tabs[t]} disabled={!canEdit} onChange={(v) => setH({ search_tabs: { ...h.search_tabs, [t]: v }, ...(!v && h.search_default === t ? { search_default: TABS.find((x) => x !== t && h.search_tabs[x]) ?? "hotels" } : {}) })} />)}
              </div>
            </Panel>
          </div>
        </div>
      </fieldset>
      {canEdit && <SaveBar dirty={f.dirty} busy={f.busy} onSave={save} onReset={f.reset} />}
    </>
  );
}

export function SectionsTab() {
  const f = useSettingsForm<Home>("/homepage", "/homepage/sections");
  const canEdit = useCan("homepage.sections", "edit");
  const toast = useToast();
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  if (f.loadError) return <ErrorNote error={f.loadError} />;
  if (!f.v) return <Loading />;
  const s = f.v.sections;
  const setS = (next: typeof s) => f.setV({ ...f.v!, sections: next });
  const move = (from: number, to: number) => {
    if (to < 0 || to >= s.length || from === to) return;
    const next = [...s];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setS(next);
  };
  const save = async () => {
    await f.save({ sections: s.map(({ key, enabled }) => ({ key, enabled })) }, "Published to the website");
  };
  return (
    <>
      <PageHead eyebrow="Homepage" title="Sections" sub="Turn homepage sections on or off and drag to change their order. The hero with the search box always comes first.">
        <Preview />
        {canEdit && <Btn variant="gold" icon="check" busy={f.busy} disabled={!f.dirty} onClick={save}>Publish</Btn>}
      </PageHead>
      <ErrorNote error={f.err} />
      <Panel className="" >
        <div style={{ maxWidth: 720 }}>
          <div className="sec-row" style={{ opacity: 0.6 }}>
            <span className="grip"><Icon name="lock" className="i-sm" /></span>
            <span style={{ fontFamily: "var(--mono)", color: "var(--faint)", fontSize: 12 }}>00</span>
            <b style={{ flex: 1, fontSize: 13 }}>Hero with search</b>
            <span className="faint" style={{ fontSize: 12 }}>Always shown</span>
          </div>
          {s.map((x, i) => (
            <div
              key={x.key}
              className="sec-row"
              data-drag={over === i && drag !== null && drag !== i ? "over" : undefined}
              draggable={canEdit}
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => { e.preventDefault(); setOver(i); }}
              onDragEnd={() => { setDrag(null); setOver(null); }}
              onDrop={(e) => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); setOver(null); }}
              style={drag === i ? { opacity: 0.4 } : undefined}
            >
              <span className="grip" aria-hidden="true"><Icon name="grip" className="i-sm" /></span>
              <span style={{ fontFamily: "var(--mono)", color: "var(--faint)", fontSize: 12 }}>{String(i + 1).padStart(2, "0")}</span>
              <b style={{ flex: 1, fontSize: 13, opacity: x.enabled ? 1 : 0.55 }}>{f.v!.labels[x.key] ?? x.key}</b>
              {canEdit && (
                <>
                  <IconBtn icon="back" label="Move up" style={{ transform: "rotate(90deg)" }} disabled={i === 0} onClick={() => move(i, i - 1)} />
                  <IconBtn icon="back" label="Move down" style={{ transform: "rotate(-90deg)" }} disabled={i === s.length - 1} onClick={() => move(i, i + 1)} />
                </>
              )}
              <Switch checked={x.enabled} label={`Show ${f.v!.labels[x.key] ?? x.key}`} disabled={!canEdit} onChange={(v) => { setS(s.map((y, j) => (j === i ? { ...y, enabled: v } : y))); if (!v) toast(`${f.v!.labels[x.key]} will be hidden once you publish`); }} />
            </div>
          ))}
        </div>
      </Panel>
      {canEdit && <SaveBar dirty={f.dirty} busy={f.busy} onSave={save} onReset={f.reset} />}
    </>
  );
}
