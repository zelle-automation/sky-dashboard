"use client";
import { use } from "react";
import { TabPage } from "@/admin/services/common";
import { RoutesTab, VehiclesTab } from "@/admin/services/transfers";

export default function TransfersPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  return (
    <TabPage section="transfers" tab={tab}>
      {(label) => (tab === "vehicles" ? <VehiclesTab label={label} /> : <RoutesTab key={tab} kind={tab === "intercity" ? "intercity" : "airport"} label={label} />)}
    </TabPage>
  );
}
