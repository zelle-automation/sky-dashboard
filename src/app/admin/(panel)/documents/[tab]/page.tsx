"use client";
// /admin/documents/<tab>: vouchers, invoice, quotation, visa letter, receipt and branding.
// ?booking=<id> preselects a booking (Bookings links here); ?enquiry=<id> starts a quotation.
import { useSearchParams } from "next/navigation";
import { Suspense, use } from "react";
import { BrandingTab } from "@/admin/docs/BrandingTab";
import { BookingDocTab, type DocTab } from "@/admin/docs/DocumentsTab";
import { QuotationTab } from "@/admin/docs/QuotationTab";
import { tabOf } from "@/admin/section-index";
import { Guard } from "@/admin/shell";
import { Empty, Loading } from "@/admin/ui";

export default function DocumentsPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  const t = tabOf("documents", tab);
  if (!t) return <Empty title="Unknown tab" />;
  return (
    <Guard perm={`documents.${tab}`}>
      <Suspense fallback={<Loading />}>
        <Tab tab={tab} label={t.label} />
      </Suspense>
    </Guard>
  );
}

function Tab({ tab, label }: { tab: string; label: string }) {
  const sp = useSearchParams();
  if (tab === "branding") return <BrandingTab />;
  if (tab === "quotation") return <QuotationTab label={label} initialEnquiry={sp.get("enquiry")} />;
  return <BookingDocTab key={tab} tab={tab as Exclude<DocTab, "quotation">} label={label} initialBooking={sp.get("booking")} />;
}
