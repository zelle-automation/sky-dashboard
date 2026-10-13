"use client";
// The dashboard frame: glass rail with sections and sub-tabs on the left, HUD bar on top
// (search, world clocks, theme, alerts). Pages render inside it.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { allowed, hasTabs, NAV, sectionOf, type Action, type Me, type Section } from "@/shared/admin-nav";
import { api, useData } from "./api";
import { initials } from "./format";
import { cx, Feedback, Icon, Loading } from "./ui";
import type { IconName } from "./icons";
import { THEME_KEY } from "./theme-init";

/* ---------- signed-in user ---------- */

const MeCtx = createContext<Me | null>(null);
export function useMe(): Me {
  const me = useContext(MeCtx);
  if (!me) throw new Error("useMe outside the dashboard shell");
  return me;
}
/** `useCan("bookings.cancelled", "edit")`, or a section key for "any tab of it". */
export function useCan(key: string, action: Action = "view") {
  return allowed(useMe(), key, action);
}

/** First tab of a section the user may open, as a URL. */
export function sectionHref(me: Me, s: Section): string | null {
  const tab = s.tabs.find((t) => allowed(me, `${s.key}.${t.key}`));
  if (!tab) return null;
  if (s.key === "overview") return "/admin";
  return hasTabs(s) ? `/admin/${s.key}/${tab.key}` : `/admin/${s.key}`;
}

/* ---------- rail override (editor sections) ---------- */

export type RailItem = { key: string; label: string; warn?: boolean };
type RailSub = { back: { href: string; label: string }; items: RailItem[]; current: string; onSelect: (key: string) => void } | null;
const RailCtx = createContext<(s: RailSub) => void>(() => {});

/** Editors call this so their sections appear as sub-tabs in the left rail. */
export function useRailSub(sub: RailSub) {
  const set = useContext(RailCtx);
  const ref = useRef(sub);
  useEffect(() => {
    ref.current = sub;
  });
  const key = sub ? sub.current + "|" + sub.items.map((i) => i.key + (i.warn ? "!" : "")).join(",") + "|" + sub.back.href : "";
  useEffect(() => {
    set(ref.current);
  }, [key, set]);
  useEffect(() => () => set(null), [set]);
}

/* ---------- theme ---------- */

type Theme = "system" | "light" | "dark";

function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    // Reading the theme pinned before hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t === "light" || t === "dark") setTheme(t);
  }, []);
  const apply = (t: Theme) => {
    setTheme(t);
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    try { if (t === "system") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, t); } catch {}
  };
  const opts: [Theme, IconName, string][] = [["system", "monitor", "Use device theme"], ["light", "sun", "Light theme"], ["dark", "moonf", "Dark theme"]];
  return (
    <div className="theme" role="group" aria-label="Theme">
      {opts.map(([v, i, l]) => (
        <button key={v} type="button" aria-label={l} title={l} aria-pressed={theme === v} onClick={() => apply(v)}><Icon name={i} /></button>
      ))}
    </div>
  );
}

/* ---------- clocks ---------- */

function Clocks() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // Clocks only render client-side to avoid a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);
  const f = (tz: string) => (now ? now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }) : "--:--");
  return (
    <div className="clocks" aria-label="Local times">
      <div className="clk"><span>Karachi</span><b>{f("Asia/Karachi")}</b></div>
      <div className="clk"><span>Makkah</span><b>{f("Asia/Riyadh")}</b></div>
      <div className="clk"><span>Dubai</span><b>{f("Asia/Dubai")}</b></div>
    </div>
  );
}

/* ---------- command palette ---------- */

type Hit = { type: string; label: string; sub?: string; href: string };

function Palette({ me, onClose }: { me: Me; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [sel, setSel] = useState(0);
  const pages = useMemo<Hit[]>(
    () => NAV.flatMap((g) => g.sections.flatMap((s) => {
      const href = sectionHref(me, s);
      if (!href) return [];
      const subs = hasTabs(s) ? s.tabs.filter((t) => allowed(me, `${s.key}.${t.key}`)).map((t) => ({ type: "Page", label: `${s.label} · ${t.label}`, href: `/admin/${s.key}/${t.key}` })) : [];
      return [{ type: "Page", label: s.label, href }, ...subs];
    })),
    [me],
  );
  useEffect(() => {
    const term = q.trim();
    const local = pages.filter((p) => p.label.toLowerCase().includes(term.toLowerCase())).slice(0, term ? 6 : 8);
    if (term.length < 2) {
      // Without a search term the palette lists pages only.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHits(local);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      const remote = await api.get<Hit[]>(`/overview/search?q=${encodeURIComponent(term)}`).catch(() => []);
      if (live) { setHits([...remote, ...local]); setSel(0); }
    }, 160);
    setHits(local);
    return () => { live = false; clearTimeout(t); };
  }, [q, pages]);
  const go = (h?: Hit) => { if (h) { router.push(h.href); onClose(); } };
  return (
    <div className="pal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pal-in" role="dialog" aria-label="Search">
        <input
          autoFocus
          value={q}
          placeholder="Search bookings, guests, hotels, pages…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter") go(hits[sel]);
          }}
        />
        <div className="res">
          {hits.length === 0 && <div className="loading">No matches</div>}
          {hits.map((h, i) => (
            <button key={h.href + i} type="button" className={i === sel ? "on" : ""} onMouseEnter={() => setSel(i)} onClick={() => go(h)}>
              <span className="pill nodot" style={{ minWidth: 70, justifyContent: "center" }}>{h.type}</span>
              <span style={{ flex: 1, minWidth: 0 }} className="trunc"><b style={{ color: "var(--text)" }}>{h.label}</b>{h.sub && <span className="faint"> · {h.sub}</span>}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- rail ---------- */

type Counts = { bookings?: Record<string, number>; enquiries?: Record<string, number> };

function Rail({ me, open, sub, counts, onNavigate }: { me: Me; open: boolean; sub: RailSub; counts: Counts; onNavigate: () => void }) {
  const path = usePathname();
  const parts = path.split("/").filter(Boolean); // ["admin", section, tab]
  const active = parts[1] ?? "overview";
  const activeTab = parts[2];
  const router = useRouter();
  async function logout() {
    await api.post("/api/auth/logout").catch(() => {});
    router.replace("/admin/login");
  }
  return (
    <aside className={cx("rail", open && "on")} aria-label="Main navigation">
      <div className="rail-in">
        <Link href="/admin" className="brand" style={{ textDecoration: "none" }} onClick={onNavigate}>
          <div className="brand-mark">S</div>
          <div><b>SKY HOLIDAYS</b><small>Control deck</small></div>
        </Link>
        <nav>
          {NAV.map((g) => {
            const visible = g.sections.filter((s) => sectionHref(me, s));
            if (!visible.length) return null;
            return (
              <div key={g.label}>
                <div className="nav-g">{g.label}</div>
                {visible.map((s) => {
                  const on = s.key === active;
                  const tabs = hasTabs(s) ? s.tabs.filter((t) => allowed(me, `${s.key}.${t.key}`)) : [];
                  const badgeN = s.badge === "bookings" ? counts.bookings?.pending : s.badge === "enquiries" ? counts.enquiries?.new : undefined;
                  return (
                    <div key={s.key}>
                      <Link
                        href={sectionHref(me, s)!}
                        className="nav-a"
                        aria-current={on ? "page" : undefined}
                        aria-expanded={tabs.length ? on : undefined}
                        style={{ textDecoration: "none" }}
                        onClick={onNavigate}
                      >
                        <Icon name={s.icon as IconName} />
                        <span>{s.label}</span>
                        {!!badgeN && <span className={cx("ct", s.badge === "enquiries" && "sig")}>{badgeN}</span>}
                        {tabs.length > 0 && <Icon name="chev" className="car" />}
                      </Link>
                      {on && sub ? (
                        <div className="nav-sub">
                          <Link className="nav-s back" href={sub.back.href} style={{ textDecoration: "none" }} onClick={onNavigate}><Icon name="back" className="i-sm" />{sub.back.label}</Link>
                          {sub.items.map((it) => (
                            <button key={it.key} type="button" className="nav-s" aria-current={sub.current === it.key} onClick={() => { sub.onSelect(it.key); onNavigate(); }}>
                              <span>{it.label}</span><span className={cx("st", it.warn && "w")} />
                            </button>
                          ))}
                        </div>
                      ) : on && tabs.length > 0 ? (
                        <div className="nav-sub">
                          {tabs.map((t) => (
                            <Link key={t.key} href={`/admin/${s.key}/${t.key}`} className="nav-s" aria-current={activeTab === t.key} style={{ textDecoration: "none" }} onClick={onNavigate}>
                              <span>{t.label}</span>
                              {s.key === "bookings" && counts.bookings?.[t.key] != null && <span className="n">{counts.bookings[t.key]}</span>}
                              {s.key === "enquiries" && counts.enquiries?.[t.key] != null && <span className="n">{counts.enquiries[t.key]}</span>}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
          <button type="button" className="nav-a logout" onClick={logout} style={{ marginTop: 8 }}><Icon name="lock" /><span>Sign out</span></button>
        </nav>
        <div className="rail-foot">
          <div className="ava">{initials(me.name)}</div>
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 13, display: "block" }} className="trunc">{me.name}</b>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{me.role}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ---------- shell ---------- */

export function Shell({ children }: { children: ReactNode }) {
  const { data: me, error } = useData<Me>("/api/auth/me");
  const [railOpen, setRailOpen] = useState(false);
  const [pal, setPal] = useState(false);
  const [sub, setSub] = useState<RailSub>(null);
  const [counts, setCounts] = useState<Counts>({});
  const path = usePathname();

  const loadCounts = useCallback(() => {
    api.get<Counts>("/overview/counts").then(setCounts).catch(() => {});
  }, []);
  useEffect(() => {
    if (!me) return;
    loadCounts();
    const t = setInterval(loadCounts, 60000);
    return () => clearInterval(t);
  }, [me, loadCounts, path]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPal(true); }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []);

  if (!me) {
    return <div className="login">{error ? <div className="err">{error}</div> : <Loading label="Opening the control deck…" />}</div>;
  }
  const section = sectionOf(path.split("/")[2] ?? "overview");
  const bellHref = allowed(me, "bookings.pending") ? "/admin/bookings/pending" : allowed(me, "enquiries.new") ? "/admin/enquiries/new" : null;

  return (
    <MeCtx.Provider value={me}>
      <RailCtx.Provider value={setSub}>
        <Feedback>
          <div className="app">
            <Rail me={me} open={railOpen} sub={section ? sub : null} counts={counts} onNavigate={() => setRailOpen(false)} />
            <main className="main">
              <header className="hud">
                <button type="button" className="hud-btn menu-btn" aria-label="Open menu" onClick={() => setRailOpen((v) => !v)}><Icon name="menu" /></button>
                <button type="button" className="cmd" aria-label="Search everything" onClick={() => setPal(true)}>
                  <Icon name="search" />
                  <span className="trunc" style={{ flex: 1, textAlign: "left" }}>Search bookings, guests, hotels…</span>
                  <span className="kbd">Ctrl K</span>
                </button>
                <Clocks />
                <ThemeSwitch />
                {bellHref && (
                  <Link href={bellHref} className="hud-btn" aria-label="Bookings awaiting payment">
                    <Icon name="bell" />
                    {!!counts.bookings?.pending && <span className="dot" />}
                  </Link>
                )}
              </header>
              <div className="view" key={path}>{children}</div>
            </main>
          </div>
          {railOpen && <div className="scrim on" style={{ zIndex: 55 }} onClick={() => setRailOpen(false)} />}
          {pal && <Palette me={me} onClose={() => setPal(false)} />}
        </Feedback>
      </RailCtx.Provider>
    </MeCtx.Provider>
  );
}

/** Shown in place of a page (or tab) the user's role does not include. */
export function NoAccess() {
  return (
    <div className="panel empty">
      <Icon name="lock" />
      <b style={{ color: "var(--text)" }}>Your role doesn’t include this page</b>
      <span>Ask an Owner to add it under Users &amp; roles.</span>
    </div>
  );
}

/** Wraps a page so it renders only when the user may view `key`. */
export function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  return useCan(perm) ? <>{children}</> : <NoAccess />;
}
