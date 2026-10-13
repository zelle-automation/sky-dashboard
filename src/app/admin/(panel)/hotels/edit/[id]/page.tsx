"use client";
import { use } from "react";
import { HotelEditor } from "@/admin/catalog/hotel-editor";
import { Guard } from "@/admin/shell";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Guard perm="hotels">
      <HotelEditor key={id} id={id} />
    </Guard>
  );
}
