"use client";
import { use } from "react";
import { CatalogList } from "@/admin/catalog/parts";
import { tabOf } from "@/admin/section-index";
import { Guard, NoAccess } from "@/admin/shell";

export default function Page({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  if (!tabOf("excursions", tab)) return <NoAccess />;
  return (
    <Guard perm={`excursions.${tab}`}>
      <CatalogList kind="excursions" tab={tab} />
    </Guard>
  );
}
