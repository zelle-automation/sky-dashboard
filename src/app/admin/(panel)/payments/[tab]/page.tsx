"use client";
// Payments: methods, transactions, slips to verify, refunds, checkout rules.
import { use } from "react";
import { LedgerTab, MethodsTab, RulesTab } from "@/admin/ops/payments";
import { tabOf } from "@/admin/section-index";
import { Guard, NoAccess } from "@/admin/shell";

export default function PaymentsTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  if (!tabOf("payments", tab)) return <NoAccess />;
  return (
    <Guard perm={`payments.${tab}`}>
      {tab === "methods" ? <MethodsTab /> : tab === "rules" ? <RulesTab /> : <LedgerTab key={tab} tab={tab as "transactions" | "verify" | "refunds"} />}
    </Guard>
  );
}
