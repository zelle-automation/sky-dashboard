"use client";
// /admin/<section> with no tab: open the first sub-tab this user may see.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { sectionOf } from "@/shared/admin-nav";
import { NoAccess, sectionHref, useMe } from "./shell";
import { Loading } from "./ui";

export function SectionIndex({ section }: { section: string }) {
  const me = useMe();
  const router = useRouter();
  const s = sectionOf(section);
  const href = s ? sectionHref(me, s) : null;
  useEffect(() => {
    if (href) router.replace(href);
  }, [href, router]);
  return href ? <Loading /> : <NoAccess />;
}

/** Validates the [tab] segment for a section; returns null for unknown tabs. */
export function tabOf(section: string, tab: string) {
  return sectionOf(section)?.tabs.find((t) => t.key === tab) ?? null;
}
