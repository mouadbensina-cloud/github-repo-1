"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ContinueSearching } from "./ContinueSearching";
import { getRecentSearch, type RecentSearch } from "@/lib/recent-search";

/**
 * The home page's "continue searching" card, sourced from whatever the
 * visitor's browser actually did last (see lib/recent-search.ts) rather than
 * a hardcoded Paris placeholder.
 *
 * Renders nothing — not even a loading skeleton — until localStorage has
 * been read. That read can only happen client-side (this whole page is a
 * static server component otherwise), so `entry` starts `undefined`
 * ("haven't checked yet") and is distinct from `null` ("checked; there
 * genuinely isn't one, e.g. a first-ever visit"). Both render nothing, but
 * keeping them separate means a real entry can only ever pop in once, never
 * flash from a wrong default first.
 */
export function RecentSearchSection() {
  const router = useRouter();
  const [entry, setEntry] = useState<RecentSearch | null | undefined>(undefined);

  useEffect(() => {
    setEntry(getRecentSearch());
  }, []);

  if (!entry) return null;

  return (
    <div className="flex justify-center">
      <ContinueSearching search={entry} onSelect={() => router.push(entry.href)} />
    </div>
  );
}
