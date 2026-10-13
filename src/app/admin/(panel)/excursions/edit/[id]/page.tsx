"use client";
import { use } from "react";
import { ExcursionEditor } from "@/admin/catalog/excursion-editor";
import { Guard } from "@/admin/shell";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Guard perm="excursions">
      <ExcursionEditor key={id} id={id} />
    </Guard>
  );
}
