"use client";
import { use } from "react";
import { TabPage } from "@/admin/services/common";
import { PackagesTab } from "@/admin/services/packages";

export default function PackagesPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  return <TabPage section="packages" tab={tab}>{(label) => <PackagesTab key={tab} tab={tab} label={label} />}</TabPage>;
}
