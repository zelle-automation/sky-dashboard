"use client";
// Enquiries: kanban Board (drag a card to move its stage) plus one table per stage,
// the enquiry drawer (?open=<id>), "Log enquiry" and bulk "Assign".
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useMemo, useState } from "react";
import { api, useData } from "@/admin/api";
import { ago, pkr } from "@/admin/format";
import { AssignModal, Avatar, EnquiryDrawer, LogEnquiryModal, StagePill } from "@/admin/ops/enquiry-drawer";
import { channelLabel, SERVICES, serviceLabel, STAGES } from "@/admin/ops/status";
import type { Enquiry } from "@/admin/ops/types";
import { tabOf } from "@/admin/section-index";
import { Guard, NoAccess, useCan } from "@/admin/shell";
import { Btn, cx, ErrorNote, Loading, PageHead, Pill, Search, Select, useToast } from "@/admin/ui";

const OLD = 4 * 3600 * 1000;

export default function EnquiriesTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  const t = tabOf("enquiries", tab);
  if (!t) return <NoAccess />;
  return (
    <Guard perm={`enquiries.${tab}`}>
      <Suspense fallback={<Loading />}><Enquiries tab={tab} /></Suspense>
    </Guard>
  );
}

function Enquiries({ tab }: { tab: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const open = sp.get("open");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [svc, setSvc] = useState("");
  const [modal, setModal] = useState<null | "log" | "assign">(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const toast = useToast();
  const canBoard = useCan("enquiries.board", "create");
  const canNew = useCan("enquiries.new", "create");
  const canLog = canBoard || canNew;
  const canEditBoard = useCan("enquiries.board", "edit");

  useEffect(() => {
    const id = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);
  const { data, error, reload, setData } = useData<Enquiry[]>(`/enquiries?tab=${tab}${term ? `&q=${encodeURIComponent(term)}` : ""}`);
  const rows = useMemo(() => (data ?? []).filter((e) => !svc || e.service.toLowerCase() === svc), [data, svc]);
  // Time-based flag computed from the loaded rows.
  const [now, setNow] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, [data]);
  const waiting = rows.filter((e) => e.status === "new" && now - new Date(e.created_at).getTime() > OLD).length;

  const setOpen = (id: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (id) p.set("open", id); else p.delete("open");
    router.replace(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false });
  };

  async function move(id: string, status: string) {
    const e = data?.find((x) => x.id === id);
    if (!e || e.status === status) return;
    if (status === "converted") { toast("Open the enquiry and use “Convert to booking”", "bad"); return; }
    if (status === "closed") { setOpen(id); toast("Pick a close reason in the enquiry"); return; }
    setData((data ?? []).map((x) => (x.id === id ? { ...x, status: status as Enquiry["status"] } : x)));
    try { await api.patch(`/enquiries/${id}`, { status }); toast(`Moved to ${STAGES.find((s) => s[0] === status)?.[1]}`); }
    catch (x) { toast((x as Error).message, "bad"); }
    reload();
  }

  const st = STAGES.find((s) => s[0] === tab);
  const unassigned = (data ?? []).filter((e) => !e.assigned_to && ["new", "contacted", "quoted"].includes(e.status)).map((e) => e.id);

  const filters = (
    <div className="row" style={{ marginBottom: 14 }}>
      <Search value={q} onChange={setQ} placeholder="Name, phone, email or message" />
      <Select aria-label="Service" value={svc} onChange={(e) => setSvc(e.target.value)} placeholder="All services" options={SERVICES.map(([value, label]) => ({ value, label }))} style={{ width: "auto" }} />
      <span className="spacer" />
      {waiting > 0 && <Pill tone="warn">{waiting} waiting longer than 4 hours</Pill>}
    </div>
  );

  return (
    <>
      {tab === "board" ? (
        <PageHead eyebrow="Enquiries" title="Board" sub="Questions and quote requests from the website, WhatsApp, phone and email. Convert one into a booking when the guest says yes.">
          {canEditBoard && <Btn icon="users" onClick={() => setModal("assign")}>Assign</Btn>}
          {canLog && <Btn variant="gold" icon="plus" onClick={() => setModal("log")}>Log enquiry</Btn>}
        </PageHead>
      ) : (
        <PageHead eyebrow="Enquiries" title={st?.[1] ?? tab} sub={data ? `${rows.length} enquir${rows.length === 1 ? "y" : "ies"} in this stage.` : undefined}>
          {canLog && tab === "new" && <Btn variant="gold" icon="plus" onClick={() => setModal("log")}>Log enquiry</Btn>}
        </PageHead>
      )}
      <ErrorNote error={error} />
      {!data && !error ? <Loading /> : tab === "board" ? (
        <>
          {filters}
          <div className="kan">
            {STAGES.map(([k, label, tone, dot]) => {
              const list = rows.filter((e) => e.status === k);
              return (
                <section key={k} className={cx("kcol", over === k && "ops-over")}
                  onDragOver={(ev) => { if (drag) { ev.preventDefault(); setOver(k); } }} onDragLeave={() => setOver(null)}
                  onDrop={(ev) => { ev.preventDefault(); setOver(null); if (drag) move(drag, k); setDrag(null); }}>
                  <div className="kcol-h"><Pill tone={tone} dot={dot !== false}>{label}</Pill><span className="n">{list.length}</span></div>
                  {list.map((e) => (
                    <article key={e.id} className="kcard" tabIndex={0} draggable={canEditBoard}
                      onDragStart={() => setDrag(e.id)} onDragEnd={() => { setDrag(null); setOver(null); }}
                      onClick={() => setOpen(e.id)} onKeyDown={(ev) => ev.key === "Enter" && setOpen(e.id)}>
                      <div className="who">
                        <Avatar name={e.name} />
                        <div style={{ minWidth: 0 }}>
                          <b style={{ fontSize: 13 }}>{e.name}</b>
                          <div className="t2" style={{ fontSize: 11.5, color: "var(--faint)" }}>{channelLabel(e.channel)} · {ago(e.created_at)}</div>
                        </div>
                      </div>
                      <div className="msg">{e.message}</div>
                      <div className="row" style={{ gap: 6 }}>
                        <Pill tone="gold" dot={false}>{serviceLabel(e.service)}</Pill>
                        {e.quote_amount != null && !e.booking_ref && <Pill dot={false}><span className="tab">{pkr(e.quote_amount)}</span></Pill>}
                        {e.booking_ref && <Pill tone="good" dot={false}><span className="mono">{e.booking_ref}</span></Pill>}
                        {e.close_reason && <Pill dot={false}>{e.close_reason}</Pill>}
                        {e.assigned_name && <span className="t2" style={{ fontSize: 11.5, color: "var(--faint)", marginLeft: "auto" }}>{e.assigned_name.split(" ")[0]}</span>}
                      </div>
                    </article>
                  ))}
                  {!list.length && <div className="t2" style={{ color: "var(--faint)", fontSize: 12, padding: "6px 4px" }}>Nothing here</div>}
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <div className="panel">
          {filters}
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Guest</th><th>Service</th><th>Message</th><th>Channel</th><th>Assigned</th><th>Received</th><th /></tr></thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="click" tabIndex={0} onClick={() => setOpen(e.id)} onKeyDown={(ev) => ev.key === "Enter" && setOpen(e.id)}>
                    <td><b>{e.name}</b><div className="t2 tab">{e.phone}</div></td>
                    <td><Pill tone="gold" dot={false}>{serviceLabel(e.service)}</Pill></td>
                    <td style={{ whiteSpace: "normal", minWidth: 260, maxWidth: 420 }}>{e.message}</td>
                    <td>{channelLabel(e.channel)}</td>
                    <td>{e.assigned_name ?? <span className="muted">–</span>}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{ago(e.created_at)}</td>
                    <td>
                      {e.booking_ref ? <Pill tone="good" dot={false}><span className="mono">{e.booking_ref}</span></Pill>
                        : e.close_reason ? <Pill dot={false}>{e.close_reason}</Pill>
                          : e.quote_amount != null ? <Pill dot={false}><span className="tab">{pkr(e.quote_amount)}</span></Pill> : <StagePill s={e.status} />}
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: 30 }}>{term || svc ? "No enquiries match your search." : "No enquiries in this stage."}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EnquiryDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />
      {modal === "log" && <LogEnquiryModal onClose={() => setModal(null)} onSaved={(e) => { setModal(null); reload(); setOpen(e.id); }} />}
      {modal === "assign" && <AssignModal ids={unassigned} onClose={() => setModal(null)} onDone={() => { setModal(null); reload(); }} />}
    </>
  );
}
