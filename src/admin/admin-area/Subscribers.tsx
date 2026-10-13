"use client";
// Website → Subscribers: newsletter sign-ups with search, CSV export and delete.
import { useEffect, useState } from "react";
import { api, useData } from "@/admin/api";
import { date, fmt } from "@/admin/format";
import { useCan, useMe } from "@/admin/shell";
import { Btn, Empty, ErrorNote, IconBtn, Kpi, Loading, PageHead, Panel, Pill, Search, Select, useConfirm, useToast } from "@/admin/ui";

type Sub = { email: string; source: string; created_at: string; unsubscribed_at: string | null };
type Res = { rows: Sub[]; stats: { active: number; this_month: number; unsubscribed: number; total: number } };

export function SubscribersPage() {
  const me = useMe();
  const canEdit = useCan("subscribers.main", "edit");
  const canDelete = useCan("subscribers.main", "delete");
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const params = new URLSearchParams();
  if (term) params.set("q", term);
  if (status) params.set("status", status);
  const res = useData<Res>(`/subscribers${params.size ? `?${params}` : ""}`);
  const st = res.data?.stats;

  async function remove(s: Sub) {
    if (!(await confirm({ title: `Delete ${s.email}?`, body: "They are removed from the list completely. To keep a record, unsubscribe them instead.", confirm: "Delete", danger: true }))) return;
    try { await api.del(`/subscribers/${encodeURIComponent(s.email)}`); toast("Deleted"); res.reload(); } catch (e) { toast((e as Error).message, "bad"); }
  }
  async function toggle(s: Sub) {
    try { await api.patch(`/subscribers/${encodeURIComponent(s.email)}`, { subscribed: !!s.unsubscribed_at }); toast(s.unsubscribed_at ? "Subscribed again" : "Unsubscribed"); res.reload(); }
    catch (e) { toast((e as Error).message, "bad"); }
  }

  return (
    <>
      <PageHead eyebrow="Website" title="Subscribers" sub="People who signed up for fares and offers.">
        {me.limits.canExport && <a className="btn" href="/api/admin/subscribers/export.csv" download><svg className="i" aria-hidden="true"><use href="#i-dl" /></svg>Export CSV</a>}
      </PageHead>
      <div className="grid g-kpi" style={{ marginBottom: 16 }}>
        <Kpi label="Subscribers" icon="mail" value={st ? fmt(st.active) : "–"} />
        <Kpi label="New this month" icon="spark" value={st ? `+${fmt(st.this_month)}` : "–"} />
        <Kpi label="Unsubscribed" icon="x" value={st ? fmt(st.unsubscribed) : "–"} delta={st && st.total ? `${fmt((st.unsubscribed / st.total) * 100, 1)}% of everyone who signed up` : undefined} />
        <Kpi label="Signed up in total" icon="users" value={st ? fmt(st.total) : "–"} />
      </div>
      <Panel actions={<div className="row"><Select value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "", label: "Everyone" }, { value: "subscribed", label: "Subscribed" }, { value: "unsubscribed", label: "Unsubscribed" }]} aria-label="Status" style={{ width: 160 }} /><Search value={q} onChange={setQ} placeholder="Search email or source" /></div>} title="Sign-ups">
        <ErrorNote error={res.error} />
        {!res.data ? <Loading /> : res.data.rows.length === 0 ? <Empty icon="mail" title={term ? "No one matches" : "No subscribers yet"} /> : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Email</th><th>Signed up from</th><th>Date</th><th>Status</th><th /></tr></thead>
              <tbody>
                {res.data.rows.map((s) => (
                  <tr key={s.email}>
                    <td><b>{s.email}</b></td>
                    <td>{s.source}</td>
                    <td className="tab">{date(s.created_at)}</td>
                    <td>{s.unsubscribed_at ? <Pill dot={false}>Unsubscribed</Pill> : <Pill tone="good">Subscribed</Pill>}</td>
                    <td>
                      <div className="row" style={{ flexWrap: "nowrap", gap: 6, justifyContent: "flex-end" }}>
                        {canEdit && <Btn size="sm" variant="ghost" onClick={() => toggle(s)}>{s.unsubscribed_at ? "Resubscribe" : "Unsubscribe"}</Btn>}
                        {canDelete && <IconBtn icon="trash" label={`Delete ${s.email}`} onClick={() => remove(s)} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
