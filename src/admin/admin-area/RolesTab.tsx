"use client";
// Users & roles → Roles & permissions: every section and sub-tab × view/create/edit/delete,
// parent rows tri-state, plus data limits. The Owner role always has everything.
import { useEffect, useState } from "react";
import { ACTIONS, hasTabs, SECTIONS, type Action } from "@/shared/admin-nav";
import { api, useData } from "@/admin/api";
import { useCan } from "@/admin/shell";
import { Btn, Check, ErrorNote, Field, Icon, Input, Loading, PageHead, SwitchRow, useConfirm, useToast } from "@/admin/ui";
import type { RoleRow } from "./UsersTab";

type Draft = Omit<RoleRow, "users" | "id"> & { id?: string; users?: number };
const blankRole = (): Draft => ({ name: "New role", description: "", permissions: {}, is_owner: false, own_bookings_only: false, hide_costs: true, mask_ids: false, can_export: false });
const cap = (a: string) => a[0].toUpperCase() + a.slice(1);

const LIMITS: [keyof Draft, string, string][] = [
  ["own_bookings_only", "Only see bookings assigned to them", "Bookings and documents show only bookings they created or are assigned to"],
  ["hide_costs", "Hide supplier cost and margin", "Supplier cost and profit are left out everywhere"],
  ["mask_ids", "Mask passport and CNIC numbers", "Shown like 35202-•••••••-1"],
  ["can_export", "Can export to Excel", "Download CSV files of bookings, payments and subscribers"],
];

export function RolesTab() {
  const roles = useData<RoleRow[]>("/users/roles");
  const canCreate = useCan("users.roles", "create");
  const canEdit = useCan("users.roles", "edit");
  const canDelete = useCan("users.roles", "delete");
  const toast = useToast();
  const confirm = useConfirm();
  const [sel, setSel] = useState<string | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!roles.data || d) return;
    const first = roles.data.find((r) => r.id === sel) ?? roles.data[0];
    // Open the first role once the list loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (first) { setSel(first.id); setD(structuredClone(first)); }
  }, [roles.data, d, sel]);

  const saved = roles.data?.find((r) => r.id === d?.id);
  const dirty = !!d && (!d.id || JSON.stringify({ ...d, users: 0 }) !== JSON.stringify({ ...saved, users: 0 }));
  const locked = !d || d.is_owner || !(d.id ? canEdit : canCreate);

  const has = (k: string, a: Action) => !!d?.permissions[k]?.includes(a);
  function setPerm(keys: string[], a: Action, on: boolean) {
    if (!d) return;
    const p = { ...d.permissions };
    for (const k of keys) {
      let acts = new Set(p[k] ?? []);
      if (on) { acts.add(a); acts.add("view"); } else if (a === "view") acts = new Set(); else acts.delete(a);
      if (acts.size) p[k] = ACTIONS.filter((x) => acts.has(x)); else delete p[k];
    }
    setD({ ...d, permissions: p });
  }

  async function pick(r: RoleRow) {
    if (dirty && !(await confirm({ title: "Discard changes?", body: `Your changes to ${d?.name} are not saved.`, confirm: "Discard", danger: true }))) return;
    setSel(r.id); setD(structuredClone(r)); setErr(null);
  }
  async function save() {
    if (!d) return;
    setBusy(true); setErr(null);
    try {
      const body = { name: d.name, description: d.description, permissions: d.permissions, own_bookings_only: d.own_bookings_only, hide_costs: d.hide_costs, mask_ids: d.mask_ids, can_export: d.can_export };
      const row = d.id ? await api.put<RoleRow>(`/users/roles/${d.id}`, body) : await api.post<RoleRow>("/users/roles", body);
      await roles.reload();
      setSel(row.id); setD({ ...row, users: d.users ?? 0 });
      toast(d.id ? "Role saved" : "Role created");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!d?.id) { setD(null); return; }
    if (!(await confirm({ title: `Delete the ${d.name} role?`, confirm: "Delete role", danger: true }))) return;
    try {
      await api.del(`/users/roles/${d.id}`);
      toast("Role deleted");
      setSel(null); setD(null);
      roles.reload();
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  }

  return (
    <>
      <PageHead eyebrow="Users & roles" title="Roles & permissions" sub="Give each role access to whole sections or to single sub-tabs. For example, a role can see only Cancelled bookings and Refunds.">
        {canCreate && <Btn icon="plus" onClick={() => { setSel(null); setD(blankRole()); setErr(null); }}>New role</Btn>}
        {d && (d.id ? canEdit : canCreate) && <Btn variant="gold" icon="check" busy={busy} disabled={!dirty} onClick={save}>Save role</Btn>}
      </PageHead>
      <ErrorNote error={roles.error} />
      {!roles.data ? <Loading /> : (
        <div className="grid g-roles">
          <div className="panel" style={{ padding: 10 }}>
            {roles.data.map((r) => (
              <button key={r.id} type="button" className="role" aria-pressed={r.id === d?.id} onClick={() => pick(r)}>
                <div className="ava" style={r.is_owner ? { background: "var(--gold-soft)", color: "var(--gold)" } : undefined}><Icon name="shield" /></div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b style={{ fontSize: 13, display: "block" }}>{r.name}</b>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{r.users} user{r.users === 1 ? "" : "s"}</span>
                </div>
              </button>
            ))}
            {d && !d.id && (
              <button type="button" className="role" aria-pressed>
                <div className="ava"><Icon name="plus" /></div>
                <div style={{ minWidth: 0, flex: 1 }}><b style={{ fontSize: 13, display: "block" }}>{d.name || "New role"}</b><span style={{ fontSize: 11.5, color: "var(--muted)" }}>Not saved yet</span></div>
              </button>
            )}
          </div>
          {d && (
            <div className="panel">
              <div className="f-grid" style={{ marginBottom: 16 }}>
                <Field label="Role name"><Input value={d.name} readOnly={!(d.id ? canEdit : canCreate)} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
                <Field label="Description"><Input value={d.description ?? ""} readOnly={!(d.id ? canEdit : canCreate)} onChange={(e) => setD({ ...d, description: e.target.value })} /></Field>
              </div>
              {d.is_owner && <div className="ok-note" style={{ marginBottom: 14 }}>The Owner role always has full access to everything, including users, roles and settings.</div>}
              <div className="tbl-wrap">
                <table className="ptree">
                  <thead><tr><th>Section and sub-tab</th>{ACTIONS.map((a) => <th key={a} style={{ textAlign: "center" }}>{cap(a)}</th>)}</tr></thead>
                  <tbody>
                    {SECTIONS.map((s) => {
                      const kids = s.tabs.map((t) => `${s.key}.${t.key}`);
                      return [
                        <tr className="par" key={s.key}>
                          <td>{s.label}</td>
                          {ACTIONS.map((a) => {
                            const n = kids.filter((k) => has(k, a)).length;
                            return (
                              <td className="c" key={a}>
                                <Check label={undefined} checked={n === kids.length} indeterminate={n > 0 && n < kids.length} disabled={locked} onChange={(v) => setPerm(kids, a, v)} />
                              </td>
                            );
                          })}
                        </tr>,
                        ...(hasTabs(s) ? s.tabs.map((t) => {
                          const k = `${s.key}.${t.key}`;
                          return (
                            <tr className="kid" key={k}>
                              <td>{t.label}</td>
                              {ACTIONS.map((a) => <td className="c" key={a}><Check checked={has(k, a)} disabled={locked} onChange={(v) => setPerm([k], a, v)} /></td>)}
                            </tr>
                          );
                        }) : []),
                      ];
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 14 }}>
                {LIMITS.map(([k, t, sub]) => (
                  <SwitchRow key={k} title={t} sub={sub} checked={d.is_owner ? k === "can_export" : !!d[k]} disabled={locked} onChange={(v) => setD({ ...d, [k]: v })} />
                ))}
              </div>
              <ErrorNote error={err} />
              {!d.is_owner && (canDelete || !d.id) && (
                <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
                  <Btn variant="ghost" icon="trash" onClick={remove} disabled={!!d.users} title={d.users ? "Move its users to another role first" : undefined}>{d.id ? "Delete role" : "Discard"}</Btn>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
