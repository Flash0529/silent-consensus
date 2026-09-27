"use client";

import { useEffect } from "react";
import { installStaleReload } from "@/components/ErrorScreen";

/** Mounted once in the root layout: pages that fail to load after an update reload themselves. */
export function StaleReload() {
  useEffect(() => installStaleReload(), []);
  return null;
}
