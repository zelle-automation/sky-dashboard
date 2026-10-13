"use client";
// Settings → Email: the SMTP server (password stored encrypted, never shown), sender details,
// a real test email, SPF/DKIM/DMARC checks for the sending domain, and the email templates.
import { useEffect, useMemo, useRef, useState } from "react";
import { api, useData } from "@/admin/api";
import { ago, fmt } from "@/admin/format";
import { useCan } from "@/admin/shell";
import { Btn, ErrorNote, Field, IconBtn, Input, Loading, PageHead, Panel, Pill, Select, useToast, type Tone } from "@/admin/ui";
import { EMAIL_VARS } from "@/admin/docs/defaults";
import { useSettingsForm } from "./Settings";

type Email = {
  provider: string; host: string; port: number; security: "starttls" | "ssl" | "none"; user: string; password_set: boolean;
  from_name: string; from_email: string; reply_to: string; bcc: string;
};
type Tpl = { key: string; name: string; trigger_label: string; attachments: string; subject: string; body: string; enabled: boolean; sent_30d: number; updated_at: string };
type Dns = { domain: string; error?: string; checks: { name: string; status: "ok" | "warn" | "bad"; detail: string; record?: string }[] };

const PROVIDERS: { value: string; label: string; host: string; port: number; security: Email["security"]; hint: string }[] = [
  { value: "smtp", label: "Custom SMTP", host: "", port: 587, security: "starttls", hint: "Your hosting company’s mail server, e.g. mail.skyholidays.pk." },
  { value: "google", label: "Google Workspace", host: "smtp.gmail.com", port: 587, security: "starttls", hint: "Username is the full address. Use an app password (Google account → Security → App passwords)." },
  { value: "microsoft", label: "Microsoft 365", host: "smtp.office365.com", port: 587, security: "starttls", hint: "Username is the full address. SMTP AUTH must be switched on for the mailbox." },
  { value: "ses", label: "Amazon SES", host: "email-smtp.me-central-1.amazonaws.com", port: 587, security: "starttls", hint: "Use the SMTP credentials from the SES console (not your AWS keys). Change the region in the host if needed." },
  { value: "brevo", label: "Brevo", host: "smtp-relay.brevo.com", port: 587, security: "starttls", hint: "Username is your Brevo login; the password is an SMTP key from Brevo → SMTP & API." },
  { value: "mailgun", label: "Mailgun", host: "smtp.mailgun.org", port: 587, security: "starttls", hint: "Use the SMTP credentials for your sending domain from Mailgun." },
];
const DNS_TONE: Record<string, Tone> = { ok: "good", warn: "warn", bad: "bad" };

export function EmailTab() {
  const f = useSettingsForm<Email>("/settings/email");
  const canEdit = useCan("settings.email", "edit");
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [dns, setDns] = useState<Dns | null>(null);
  const [dnsErr, setDnsErr] = useState<string | null>(null);
  const [dnsBusy, setDnsBusy] = useState(false);
  const [selector, setSelector] = useState("");

  const domain = f.v?.from_email.split("@")[1] ?? "";
  async function checkDns() {
    if (!domain) return;
    setDnsBusy(true); setDnsErr(null);
    try {
      const r = await api.get<Dns>(`/settings/email/dns?domain=${encodeURIComponent(domain)}${selector ? `&selector=${encodeURIComponent(selector)}` : ""}`);
      setDns(r.error ? null : r);
      setDnsErr(r.error ?? null);
    } catch (e) { setDns(null); setDnsErr((e as Error).message); }
    finally { setDnsBusy(false); }
  }
  const savedDomain = useRef("");
  useEffect(() => {
    if (!f.v || savedDomain.current) return;
    savedDomain.current = domain;
    checkDns();
    // Check the saved domain once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.v]);

  if (f.loadError) return <ErrorNote error={f.loadError} />;
  if (!f.v) return <Loading />;
  const e = f.v;
  const set = (p: Partial<Email>) => f.setV({ ...e, ...p });
  const prov = PROVIDERS.find((p) => p.value === e.provider) ?? PROVIDERS[0];
  const body = () => ({ provider: e.provider, host: e.host, port: e.port, security: e.security, user: e.user, password: pw || undefined, from_name: e.from_name, from_email: e.from_email, reply_to: e.reply_to, bcc: e.bcc });
  const dirty = f.dirty || !!pw;

  async function save() {
    const out = await f.save(body(), "Email settings saved");
    if (out) { setPw(""); if (domain !== savedDomain.current) { savedDomain.current = domain; checkDns(); } }
  }
  async function clearPw() {
    const out = await f.save({ ...body(), password: undefined, clear_password: true }, "Password removed");
    if (out) setPw("");
  }
  async function test() {
    setTesting(true); setTestResult(null);
    try {
      await api.post("/settings/email/test", { to: testTo, draft: dirty ? body() : undefined });
      setTestResult({ ok: true, msg: `Sent to ${testTo}. Check the inbox (and spam folder).` });
      toast("Test email sent");
    } catch (err) {
      setTestResult({ ok: false, msg: (err as Error).message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <PageHead eyebrow="Settings" title="Email" sub="Set up how the system sends email. No code changes needed: save here and the next email uses these settings.">
        {canEdit && <Btn variant="gold" icon="check" busy={f.busy} disabled={!dirty} onClick={save}>Save email settings</Btn>}
      </PageHead>
      <ErrorNote error={f.err} />
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="grid g-2" style={{ alignItems: "start", marginBottom: 16 }}>
          <Panel title="Sending server" actions={e.host && e.password_set ? <Pill tone="good">Set up</Pill> : e.host ? <Pill tone="warn">No password</Pill> : <Pill>Not set up</Pill>}>
            <div className="f-grid">
              <Field label="Provider" className="span-all" hint={prov.hint}>
                <Select value={e.provider} onChange={(ev) => {
                  const p = PROVIDERS.find((x) => x.value === ev.target.value)!;
                  set({ provider: p.value, ...(p.host ? { host: p.host, port: p.port, security: p.security } : {}) });
                }} options={PROVIDERS.map((p) => ({ value: p.value, label: p.label }))} />
              </Field>
              <Field label="SMTP host"><Input value={e.host} onChange={(ev) => set({ host: ev.target.value.trim() })} placeholder="mail.skyholidays.pk" /></Field>
              <Field label="Port">
                <Select value={String(e.port)} onChange={(ev) => { const port = Number(ev.target.value); set({ port, security: port === 465 ? "ssl" : port === 25 ? e.security : "starttls" }); }}
                  options={[...new Set(["587", "465", "25", "2525", String(e.port)])]} />
              </Field>
              <Field label="Security">
                <Select value={e.security} onChange={(ev) => set({ security: ev.target.value as Email["security"] })} options={[{ value: "starttls", label: "STARTTLS" }, { value: "ssl", label: "SSL/TLS" }, { value: "none", label: "None" }]} />
              </Field>
              <Field label="Username"><Input value={e.user} onChange={(ev) => set({ user: ev.target.value.trim() })} autoComplete="off" /></Field>
              <Field label="Password" className="span-all" hint="Stored encrypted. It is never shown again.">
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <Input type="password" value={pw} onChange={(ev) => setPw(ev.target.value)} autoComplete="new-password" placeholder={e.password_set ? "Saved. Type a new one to change it" : "Not set"} />
                  {e.password_set && canEdit && <Btn size="sm" variant="ghost" onClick={clearPw}>Remove</Btn>}
                </div>
              </Field>
            </div>
          </Panel>
          <Panel title="Sender">
            <div className="f-grid">
              <Field label="From name"><Input value={e.from_name} onChange={(ev) => set({ from_name: ev.target.value })} /></Field>
              <Field label="From email"><Input type="email" value={e.from_email} onChange={(ev) => set({ from_email: ev.target.value.trim() })} /></Field>
              <Field label="Reply-to"><Input type="email" value={e.reply_to} onChange={(ev) => set({ reply_to: ev.target.value.trim() })} placeholder="Same as From" /></Field>
              <Field label="Copy all emails to" hint="Office copy (BCC)"><Input type="email" value={e.bcc} onChange={(ev) => set({ bcc: ev.target.value.trim() })} placeholder="accounts@skyholidays.pk" /></Field>
            </div>
            <div className="row" style={{ marginTop: 14, flexWrap: "nowrap" }}>
              <Input type="email" value={testTo} onChange={(ev) => setTestTo(ev.target.value)} placeholder="Send a test to this address" aria-label="Test email address" />
              <Btn icon="send" busy={testing} disabled={!testTo.includes("@") || !e.host} onClick={test}>Send test</Btn>
            </div>
            {dirty && <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>The test uses what is on screen, even before you save.</div>}
            {testResult && <div className={testResult.ok ? "ok-note" : "err"} style={{ marginTop: 10, wordBreak: "break-word" }}>{testResult.msg}</div>}
            <div className="row" style={{ marginTop: 16 }}>
              <b style={{ fontSize: 13, flex: 1 }}>Domain checks{domain && <span className="faint" style={{ fontWeight: 500 }}> · {domain}</span>}</b>
              <Input value={selector} onChange={(ev) => setSelector(ev.target.value.trim())} placeholder="DKIM selector" aria-label="DKIM selector" style={{ width: 130 }} />
              <Btn size="sm" icon="refresh" busy={dnsBusy} disabled={!domain} onClick={checkDns}>Check</Btn>
            </div>
            <ErrorNote error={dnsErr} />
            {dns && (
              <div className="list" style={{ marginTop: 6 }}>
                {dns.checks.map((c) => (
                  <div className="li" key={c.name} style={{ alignItems: "flex-start" }}>
                    <div className="grow">
                      <b style={{ fontSize: 13 }}>{c.name}</b>
                      <div className="t2" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>{c.status === "ok" && c.record ? <code style={{ fontSize: 11 }}>{c.record}</code> : c.detail}</div>
                    </div>
                    <Pill tone={DNS_TONE[c.status]}>{c.status === "ok" ? "Found" : c.status === "warn" ? "Not set" : "Missing"}</Pill>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </fieldset>
      <Templates />
    </>
  );
}

function Templates() {
  const list = useData<Tpl[]>("/settings/email/templates");
  const canEdit = useCan("settings.email", "edit");
  const toast = useToast();
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const cur = useMemo(() => list.data?.find((t) => t.key === (key ?? list.data?.find((x) => x.key === "booking_confirmed")?.key ?? list.data?.[0]?.key)) ?? null, [list.data, key]);
  useEffect(() => {
    // Load the chosen template into the editor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cur) { setDraft({ subject: cur.subject, body: cur.body }); setErr(null); }
  }, [cur]);
  useEffect(() => {
    if (!cur || !draft) return;
    const t = setTimeout(() => {
      api.post<{ subject: string; html: string }>(`/settings/email/templates/${cur.key}/preview`, draft).then(setPreview).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [cur, draft]);

  async function toggle(t: Tpl, on: boolean) {
    list.setData((list.data ?? []).map((x) => (x.key === t.key ? { ...x, enabled: on } : x)));
    try { await api.put(`/settings/email/templates/${t.key}`, { enabled: on }); toast(on ? `${t.name} switched on` : `${t.name} switched off`); }
    catch (e) { toast((e as Error).message, "bad"); list.reload(); }
  }
  async function save() {
    if (!cur || !draft) return;
    setBusy(true); setErr(null);
    try {
      const row = await api.put<Tpl>(`/settings/email/templates/${cur.key}`, draft);
      list.setData((list.data ?? []).map((x) => (x.key === row.key ? { ...x, ...row } : x)));
      toast("Template saved");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resetTpl() {
    if (!cur) return;
    try {
      const row = await api.post<Tpl>(`/settings/email/templates/${cur.key}/reset`);
      list.setData((list.data ?? []).map((x) => (x.key === row.key ? { ...x, ...row } : x)));
      toast("Back to the default wording");
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  }
  function insert(v: string) {
    if (!draft) return;
    const ta = bodyRef.current;
    const tag = `{{${v}}}`;
    if (!ta) return setDraft({ ...draft, body: draft.body + tag });
    const s = ta.selectionStart ?? draft.body.length, e = ta.selectionEnd ?? s;
    setDraft({ ...draft, body: draft.body.slice(0, s) + tag + draft.body.slice(e) });
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + tag.length, s + tag.length); });
  }
  const dirty = !!cur && !!draft && (draft.subject !== cur.subject || draft.body !== cur.body);

  return (
    <div className="grid g-ov" style={{ alignItems: "start" }}>
      <Panel title="Email templates">
        <ErrorNote error={list.error} />
        {!list.data ? <Loading /> : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Template</th><th>Sent</th><th>Attachments</th><th style={{ textAlign: "right" }}>30 days</th><th>On</th><th /></tr></thead>
              <tbody>
                {list.data.map((t) => (
                  <tr key={t.key} style={t.key === cur?.key ? { background: "var(--gold-soft)" } : undefined}>
                    <td><b>{t.name}</b></td>
                    <td className="t2" style={{ whiteSpace: "normal", color: "var(--muted)", fontSize: 12.5, minWidth: 160 }}>{t.trigger_label}</td>
                    <td>{t.attachments}</td>
                    <td className="tab" style={{ textAlign: "right" }}>{fmt(t.sent_30d)}</td>
                    <td><button type="button" className="sw" role="switch" aria-checked={t.enabled} aria-label={`${t.name} on or off`} disabled={!canEdit} onClick={() => toggle(t, !t.enabled)} /></td>
                    <td><IconBtn icon="edit" label={`Edit ${t.name}`} onClick={() => setKey(t.key)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title={cur?.name ?? "Template"} actions={cur && <span className="faint" style={{ fontSize: 11.5 }}>Edited {ago(cur.updated_at)}</span>}>
        {cur && draft && (
          <fieldset disabled={!canEdit} className="grid" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <Field label="Subject"><Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></Field>
            <Field label="Message" hint="A blank line starts a new paragraph."><textarea className="inp" ref={bodyRef} rows={10} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></Field>
            <div className="fld">
              <span className="lab">Insert</span>
              <div className="row" style={{ gap: 6 }}>
                {EMAIL_VARS.map((v) => <button key={v} type="button" className="btn btn-sm" style={{ fontFamily: "var(--mono)", fontSize: 11 }} onClick={() => insert(v)}>{`{{${v}}}`}</button>)}
              </div>
            </div>
            <ErrorNote error={err} />
            {canEdit && (
              <div className="row">
                <Btn variant="gold" icon="check" busy={busy} disabled={!dirty} onClick={save}>Save template</Btn>
                {dirty && <Btn variant="ghost" onClick={() => setDraft({ subject: cur.subject, body: cur.body })}>Undo</Btn>}
                <Btn variant="ghost" icon="refresh" onClick={resetTpl}>Default wording</Btn>
              </div>
            )}
            {preview && (
              <div className="fld">
                <span className="lab">Preview with sample details</span>
                <div className="tpl-prev">
                  <div style={{ padding: "10px 14px", background: "#fff", color: "#0D1B3A", fontSize: 13, borderBottom: "1px solid #E1E6EF" }}><b>{preview.subject}</b></div>
                  <iframe title="Email preview" sandbox="" srcDoc={preview.html} />
                </div>
              </div>
            )}
          </fieldset>
        )}
      </Panel>
    </div>
  );
}
