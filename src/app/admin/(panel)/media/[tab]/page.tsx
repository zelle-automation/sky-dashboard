"use client";
import Link from "next/link";
import { use, useRef, useState } from "react";
import { api, uploadFile, useData } from "@/admin/api";
import { date, fmt } from "@/admin/format";
import { Guard, useCan } from "@/admin/shell";
import { tabOf } from "@/admin/section-index";
import { Btn, Empty, ErrorNote, Field, Icon, Input, Loading, Modal, PageHead, Panel, Pill, Search, useConfirm, useToast } from "@/admin/ui";

type MediaRow = { id: string; url: string; file_name: string; mime_type: string; size_bytes: number; width: number | null; height: number | null; folder: string; alt_text: string | null; created_at: string; uploaded_by: string | null };
type Pair = { id: string; name: string; image_day_url: string | null; image_night_url: string | null; href: string };

const SUB: Record<string, string> = {
  all: "Every uploaded photo and file. Catalogue photos come in day and evening pairs: the light theme shows the day photo, the dark theme the evening one.",
  hotels: "Day and evening photo pairs for each hotel, plus photos uploaded for hotels.",
  excursions: "Day and evening photo pairs for each excursion, plus photos uploaded for excursions.",
  destinations: "Day and evening photo pairs for each destination, plus photos uploaded for destinations.",
  branding: "Logos, voucher cover and letterhead images used on documents.",
};

const kb = (n: number) => (n > 1024 * 1024 ? `${fmt(n / 1024 / 1024, 1)} MB` : `${fmt(n / 1024)} KB`);

export default function MediaPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  const t = tabOf("media", tab);
  if (!t) return <Empty title="Unknown tab" />;
  return (
    <Guard perm={`media.${tab}`}>
      <MediaTab tab={tab} label={t.label} />
    </Guard>
  );
}

function MediaTab({ tab, label }: { tab: string; label: string }) {
  const folder = tab === "all" ? "all" : tab;
  const files = useData<MediaRow[]>(`/media?folder=${folder}`);
  const pairs = useData<Pair[]>(["hotels", "excursions", "destinations"].includes(tab) ? `/media/pairs?type=${tab}` : null);
  const canDelete = useCan("media.all", "delete");
  const canEdit = useCan("media.all", "edit");
  const toast = useToast();
  const confirm = useConfirm();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<MediaRow | null>(null);
  const [alt, setAlt] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true); setErr(null);
    try {
      for (const f of Array.from(list)) await uploadFile(f, tab === "all" ? "general" : tab);
      toast(list.length > 1 ? `${list.length} files uploaded` : "Uploaded");
      files.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(m: MediaRow) {
    const ok = await confirm({ title: "Delete this photo?", body: "Pages still using its link will show no image.", confirm: "Delete", danger: true });
    if (!ok) return;
    try {
      await api.del(`/media/${m.id}`);
      toast("Deleted");
      setSel(null);
      files.reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  }

  async function saveAlt() {
    if (!sel) return;
    try {
      await api.patch(`/media/${sel.id}`, { alt_text: alt });
      toast("Saved");
      setSel(null);
      files.reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  }

  const term = q.trim().toLowerCase();
  const list = (files.data ?? []).filter((m) => !term || m.file_name.toLowerCase().includes(term) || m.alt_text?.toLowerCase().includes(term));
  const pairList = (pairs.data ?? []).filter((p) => !term || p.name.toLowerCase().includes(term));
  const missing = (pairs.data ?? []).filter((p) => !p.image_night_url || !p.image_day_url).length;

  return (
    <>
      <PageHead eyebrow="Media library" title={label} sub={SUB[tab]}>
        <Search value={q} onChange={setQ} placeholder="Search photos" />
        <Btn variant="gold" icon="upload" busy={busy} onClick={() => input.current?.click()}>Upload</Btn>
        <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
      </PageHead>
      <ErrorNote error={err ?? files.error ?? pairs.error} />

      {pairs.data && (
        <Panel title="Photo pairs" actions={missing ? <Pill tone="warn">{missing} missing a day or evening photo</Pill> : <Pill tone="good">All pairs complete</Pill>} className="no-print">
          <div className="ph-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))" }}>
            {pairList.map((p) => (
              <Link key={p.id} href={p.href} className="ph-item" style={{ textDecoration: "none" }}>
                <div className="ph-pair">
                  <div style={{ backgroundImage: p.image_day_url ? `url("${p.image_day_url}")` : undefined }}><span>{p.image_day_url ? "Day" : "No day photo"}</span></div>
                  <div style={{ backgroundImage: p.image_night_url ? `url("${p.image_night_url}")` : undefined }}><span>{p.image_night_url ? "Evening" : "No evening photo"}</span></div>
                </div>
                <div className="ph-meta"><b className="trunc" style={{ flex: 1 }}>{p.name}</b>{(!p.image_day_url || !p.image_night_url) && <Pill tone="warn" dot={false}>Missing</Pill>}</div>
              </Link>
            ))}
          </div>
        </Panel>
      )}

      <div style={{ height: pairs.data ? 16 : 0 }} />
      <Panel title="Uploaded files" label={files.data ? `${list.length} files` : undefined}>
        {files.loading && !files.data ? <Loading /> : list.length === 0 ? (
          <Empty icon="image" title="No uploads here yet">Upload photos with the button above, or from any editor.</Empty>
        ) : (
          <div className="ph-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))" }}>
            {list.map((m) => (
              <div className="ph-item" key={m.id}>
                <button type="button" style={{ display: "block", width: "100%" }} onClick={() => { setSel(m); setAlt(m.alt_text ?? ""); }} aria-label={`Open ${m.file_name}`}>
                  {m.mime_type.startsWith("image/") ? (
                    <div style={{ aspectRatio: "4/3", backgroundImage: `url("${m.url}")`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  ) : (
                    <div style={{ aspectRatio: "4/3", display: "grid", placeItems: "center", color: "var(--gold)" }}><Icon name="file" /></div>
                  )}
                </button>
                <div className="ph-meta" style={{ flexDirection: "column", alignItems: "flex-start", gap: 0 }}>
                  <b className="trunc" style={{ maxWidth: "100%" }}>{m.file_name}</b>
                  <span style={{ color: "var(--faint)", fontWeight: 500, fontSize: 11.5 }}>
                    {m.folder} · {m.width && m.height ? `${m.width} × ${m.height}` : kb(m.size_bytes)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.file_name ?? ""} wide foot={sel && <>
        {canDelete && <Btn variant="danger" icon="trash" onClick={() => remove(sel)}>Delete</Btn>}
        <span className="spacer" />
        <Btn icon="file" onClick={() => { navigator.clipboard?.writeText(location.origin + sel.url); toast("Link copied"); }}>Copy link</Btn>
        {canEdit && <Btn variant="gold" icon="check" onClick={saveAlt}>Save</Btn>}
      </>}>
        {sel && (
          <>
            {sel.mime_type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sel.url} alt={sel.alt_text ?? ""} style={{ width: "100%", borderRadius: 14, border: "1px solid var(--line)", maxHeight: "50vh", objectFit: "contain", background: "var(--surface-2)" }} />
            ) : (
              <a className="btn" href={sel.url} target="_blank" rel="noreferrer"><Icon name="eye" />Open file</a>
            )}
            <div className="row" style={{ gap: 18, fontSize: 12.5 }}>
              <span className="muted">{sel.width && sel.height ? `${sel.width} × ${sel.height} px · ` : ""}{kb(sel.size_bytes)}</span>
              <span className="muted">Uploaded {date(sel.created_at)}{sel.uploaded_by ? ` by ${sel.uploaded_by}` : ""}</span>
            </div>
            <Field label="Alt text" hint="Describes the photo for screen readers and search engines.">
              <Input value={alt} onChange={(e) => setAlt(e.target.value)} disabled={!canEdit} placeholder="e.g. Pool terrace at sunset" />
            </Field>
          </>
        )}
      </Modal>
    </>
  );
}
