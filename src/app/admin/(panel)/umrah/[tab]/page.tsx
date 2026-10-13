"use client";
import { use } from "react";
import { TabPage } from "@/admin/services/common";
import { FlexibleTab, GroupsTab, HotelsTab } from "@/admin/services/umrah";

export default function UmrahPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  return (
    <TabPage section="umrah" tab={tab}>
      {(label) => (tab === "groups" ? <GroupsTab label={label} /> : tab === "hotels" ? <HotelsTab label={label} /> : <FlexibleTab label={label} />)}
    </TabPage>
  );
}
