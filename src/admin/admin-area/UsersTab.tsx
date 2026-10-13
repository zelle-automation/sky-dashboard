"use client";
// Users & roles → Users: who can sign in, their role, invite, edit, deactivate, reset password.
import { useState } from "react";
import { api, useData } from "@/admin/api";
import { ago, initials } from "@/admin/format";
import { useCan, useMe } from "@/admin/shell";
import { Btn, Check, Empty, ErrorNote, Field, IconBtn, Input, Loading, Modal, PageHead, Panel, Pill, Search, Select, SwitchRow, useConfirm, useToast } from "@/admin/ui";

export type RoleRow = {
  id: string; name: string; description: string | null; permissions: Record<string, string[]>; is_owner: boolean;
  own_bookings_only: boolean; hide_costs: boolean; mask_ids: boolean; can_export: boolean; users: number;
};
type UserRow = { id: string; email: string; name: string; phone: string | null; role_id: string; role_name: string; is_owner: boolean; is_active: boolean; last_login_at: string | null; created_at: string };

function TempPassword({ value, name, onClose }: { value: string | null; name: string; onClose: () => void }) {
  const toast = useToast();
  return (
    <Modal open={!!value} onClose={onClose} title="Temporary password" foot={<Btn variant="gold" onClick={onClose}>Done</Btn>}>
      <p className="muted" style={{ margin: 0 }}>Give this to {name} privately. It is shown only once; they can sign in with it straight away.</p>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <Input readOnly value={value ?? ""} style={{ fontFamily: "var(--mono)", fontSize: 15 }} aria-label="Temporary password" />
        <Btn icon="check" onClick={() => { navigator.clipboard?.writeText(value ?? ""); toast("Copied"); }}>Copy</Btn>
      </div>
    </Modal>
  );
}

export function UsersTab() {
  const me = useMe();
  const users = useData<UserRow[]>("/users");
  const roles = useData<RoleRow[]>("/users/roles");
  const canCreate = useCan("users.users", "create");
  const canEdit = useCan("users.users", "edit");
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const [invite, setInvite] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role_id: "", send_invite: true });
  const [edit, setEdit] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [temp, setTemp] = useState<{ pw: string; name: string } | null>(null);

  const roleOpts = (roles.data ?? []).filter((r) => me.isOwner || !r.is_owner).map((r) => ({ value: r.id, label: r.name }));
  const roleDesc = (id: string) => roles.data?.find((r) => r.id === id)?.description ?? "";
  const list = (users.data ?? []).filter((u) => !q || `${u.name} ${u.email} ${u.role_name}`.toLowerCase().includes(q.toLowerCase()));

  async function create() {
    setBusy(true); setErr(null);
    try {
      const r = await api.post<{ temp_password: string; invite: { sent: boolean; error?: string } | null }>("/users", { ...form, phone: form.phone || null });
      setInvite(false);
      users.reload(); roles.reload();
      if (r.invite && !r.invite.sent) toast(`Account created, but the invite email failed: ${r.invite.error}`, "bad");
      else if (r.invite?.sent) toast(`Invite emailed to ${form.email}`);
      setTemp({ pw: r.temp_password, name: form.name });
      setForm({ name: "", email: "", phone: "", role_id: "", send_invite: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveEdit() {
    if (!edit) return;
    setBusy(true); setErr(null);
    try {
      await api.patch(`/users/${edit.id}`, { name: edit.name, phone: edit.phone || null, role_id: edit.role_id, is_active: edit.is_active });
      setEdit(null);
      users.reload(); roles.reload();
      toast("Saved");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(u: UserRow) {
    if (u.is_active && !(await confirm({ title: `Deactivate ${u.name}?`, body: "They are signed out everywhere and can’t sign in until you activate them again.", confirm: "Deactivate", danger: true }))) return;
    try {
      await api.patch(`/users/${u.id}`, { is_active: !u.is_active });
      users.reload();
      toast(u.is_active ? "Deactivated" : "Activated");
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  }
  async function reset(u: UserRow) {
    if (!(await confirm({ title: `Reset ${u.name}’s password?`, body: "A new temporary password is made and they are signed out everywhere.", confirm: "Reset password" }))) return;
    try {
      const r = await api.post<{ temp_password: string }>(`/users/${u.id}/reset-password`);
      setTemp({ pw: r.temp_password, name: u.name });
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  }

  return (
    <>
      <PageHead eyebrow="Users & roles" title="Users" sub="Who can sign in. Each person gets one role, and the role decides what they can see and change.">
        <Search value={q} onChange={setQ} placeholder="Search people" />
        {canCreate && <Btn variant="gold" icon="plus" onClick={() => { setErr(null); setForm((f) => ({ ...f, role_id: f.role_id || roleOpts.find((o) => o.label !== "Owner")?.value || "" })); setInvite(true); }}>Invite user</Btn>}
      </PageHead>
      <ErrorNote error={users.error} />
      <Panel>
        {users.loading && !users.data ? <Loading /> : list.length === 0 ? <Empty icon="users" title="No one matches" /> : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Name</th><th>Role</th><th>Access</th><th>Phone</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} style={u.is_active ? undefined : { opacity: 0.6 }}>
                    <td>
                      <div className="row" style={{ flexWrap: "nowrap" }}>
                        <div className="ava" style={u.is_owner ? { background: "var(--gold-soft)", color: "var(--gold)" } : undefined}>{initials(u.name)}</div>
                        <div style={{ minWidth: 0 }}><b>{u.name}</b>{u.id === me.id && <span className="faint"> (you)</span>}<div className="faint" style={{ fontSize: 12 }}>{u.email}</div></div>
                      </div>
                    </td>
                    <td><Pill tone={u.is_owner ? "gold" : "info"}>{u.role_name}</Pill></td>
                    <td className="muted" style={{ whiteSpace: "normal", minWidth: 180, fontSize: 12.5 }}>{roleDesc(u.role_id)}</td>
                    <td className="tab">{u.phone || "–"}</td>
                    <td>{u.last_login_at ? ago(u.last_login_at) : <span className="faint">Never</span>}</td>
                    <td>{u.is_active ? <Pill tone="good">Active</Pill> : <Pill>Deactivated</Pill>}</td>
                    <td>
                      {canEdit && (
                        <div className="row" style={{ flexWrap: "nowrap", gap: 6, justifyContent: "flex-end" }}>
                          <IconBtn icon="edit" label={`Edit ${u.name}`} onClick={() => { setErr(null); setEdit({ ...u }); }} />
                          <IconBtn icon="key" label={`Reset password for ${u.name}`} onClick={() => reset(u)} />
                          {u.id !== me.id && <Btn size="sm" variant={u.is_active ? "ghost" : "plain"} onClick={() => toggle(u)}>{u.is_active ? "Deactivate" : "Activate"}</Btn>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={invite} onClose={() => setInvite(false)} title="Invite user" foot={<><Btn variant="ghost" onClick={() => setInvite(false)}>Cancel</Btn><Btn variant="gold" icon="plus" busy={busy} onClick={create}>Create account</Btn></>}>
        <div className="f-grid">
          <Field label="Full name" className="span-all"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+92 3xx xxxxxxx" /></Field>
          <Field label="Role" className="span-all" hint={roleDesc(form.role_id)}><Select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} options={roleOpts} placeholder="Choose a role" /></Field>
        </div>
        <Check label="Email them the sign-in link and temporary password" checked={form.send_invite} onChange={(v) => setForm({ ...form, send_invite: v })} />
        <ErrorNote error={err} />
      </Modal>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `Edit ${edit.name}` : ""} foot={<><Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn><Btn variant="gold" icon="check" busy={busy} onClick={saveEdit}>Save</Btn></>}>
        {edit && (
          <>
            <div className="f-grid">
              <Field label="Full name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Phone"><Input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
              <Field label="Email" className="span-all" hint="Email can’t be changed. Invite a new account instead."><Input value={edit.email} readOnly /></Field>
              <Field label="Role" className="span-all" hint={roleDesc(edit.role_id)}>
                <Select value={edit.role_id} onChange={(e) => setEdit({ ...edit, role_id: e.target.value })} options={edit.is_owner && !me.isOwner ? [{ value: edit.role_id, label: edit.role_name }] : roleOpts} />
              </Field>
            </div>
            {edit.id !== me.id && <SwitchRow title="Can sign in" sub="Switch off to deactivate this account" checked={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} />}
            <ErrorNote error={err} />
          </>
        )}
      </Modal>
      <TempPassword value={temp?.pw ?? null} name={temp?.name ?? ""} onClose={() => setTemp(null)} />
    </>
  );
}
