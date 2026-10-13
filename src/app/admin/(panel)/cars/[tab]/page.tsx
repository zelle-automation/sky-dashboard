"use client";
import { use } from "react";
import { TabPage } from "@/admin/services/common";
import { DriversTab, FleetTab, RatesTab } from "@/admin/services/cars";

export default function CarsPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  return (
    <TabPage section="cars" tab={tab}>
      {(label) => (tab === "rates" ? <RatesTab label={label} /> : tab === "drivers" ? <DriversTab label={label} /> : <FleetTab label={label} />)}
    </TabPage>
  );
}
