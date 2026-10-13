"use client";
import { use } from "react";
import { HeroTab, SectionsTab } from "@/admin/admin-area/Homepage";
import { tabOf } from "@/admin/section-index";
import { Guard } from "@/admin/shell";
import { Empty } from "@/admin/ui";

export default function HomepagePage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  if (!tabOf("homepage", tab)) return <Empty title="Unknown tab" />;
  return <Guard perm={`homepage.${tab}`}>{tab === "sections" ? <SectionsTab /> : <HeroTab />}</Guard>;
}
