"use client";

import { useEffect } from "react";

// Resolve after asynchronous records render; choose the visible desktop/mobile copy.
export function useLinkedRecord(recordsKey: string) {
  useEffect(() => {
    const focusRecord = () => {
      let key: string;
      try { key = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      document.querySelectorAll("[data-linked-active]").forEach((element) => element.removeAttribute("data-linked-active"));
      if (!key) return;
      const target = Array.from(document.querySelectorAll<HTMLElement>("[data-linked-record]"))
        .find((element) => element.dataset.linkedRecord === key && element.getClientRects().length > 0);
      if (!target) return;
      target.setAttribute("data-linked-active", "true");
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "center" });
    };
    focusRecord();
    window.addEventListener("hashchange", focusRecord);
    return () => window.removeEventListener("hashchange", focusRecord);
  }, [recordsKey]);
}
