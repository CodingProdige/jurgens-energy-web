"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import {
  flushGoogleEventQueue,
  trackGoogleEvent,
  type GoogleTagMode,
} from "@/src/modules/analytics/google";

type LeadClickEventName =
  | "directions_click"
  | "email_click"
  | "phone_click"
  | "whatsapp_click";

function getClickPlacement(anchor: HTMLAnchorElement) {
  const explicitPlacement =
    anchor.dataset.analyticsPlacement ??
    anchor
      .closest<HTMLElement>("[data-analytics-placement]")
      ?.dataset.analyticsPlacement;

  if (explicitPlacement) {
    return explicitPlacement;
  }

  if (anchor.closest("footer")) {
    return "footer";
  }

  if (anchor.closest("header")) {
    return "header";
  }

  if (anchor.closest("nav")) {
    return "navigation";
  }

  if (anchor.classList.contains("fixed")) {
    return "floating_action";
  }

  if (anchor.closest("main")) {
    return "page_content";
  }

  return "other";
}

function getLeadClickEventName(href: string): LeadClickEventName | null {
  let url: URL;

  try {
    url = new URL(href, window.location.href);
  } catch {
    return null;
  }

  if (url.protocol === "tel:") {
    return "phone_click";
  }

  if (url.protocol === "mailto:") {
    return "email_click";
  }

  if (url.protocol === "whatsapp:") {
    return "whatsapp_click";
  }

  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();

  if (
    hostname === "wa.me" ||
    hostname.endsWith(".wa.me") ||
    hostname === "api.whatsapp.com" ||
    hostname === "web.whatsapp.com"
  ) {
    return "whatsapp_click";
  }

  if (
    hostname === "maps.google.com" ||
    hostname === "maps.app.goo.gl" ||
    hostname === "maps.apple.com" ||
    hostname === "waze.com" ||
    hostname.endsWith(".waze.com") ||
    (hostname.endsWith("google.com") && pathname.startsWith("/maps"))
  ) {
    return "directions_click";
  }

  return null;
}

export function MarketplaceGoogleRuntime({
  mode,
  trackPageViews,
}: {
  mode: GoogleTagMode;
  trackPageViews: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    const flush = () => flushGoogleEventQueue();

    flush();
    window.addEventListener("jurgens:google-tags-ready", flush);

    return () => window.removeEventListener("jurgens:google-tags-ready", flush);
  }, []);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || !(event.target instanceof Element)) {
        return;
      }

      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      const href = anchor?.getAttribute("href");

      if (!anchor || !href || anchor.dataset.analyticsTracking === "off") {
        return;
      }

      if (
        anchor.dataset.analyticsEvent === "select_item" &&
        anchor.dataset.analyticsItemId &&
        anchor.dataset.analyticsItemName
      ) {
        trackGoogleEvent("select_item", {
          item_list_id: window.location.pathname,
          item_list_name: document.title,
          items: [
            {
              item_brand: anchor.dataset.analyticsItemBrand,
              item_category: anchor.dataset.analyticsItemCategory,
              item_id: anchor.dataset.analyticsItemId,
              item_list_id: window.location.pathname,
              item_list_name: document.title,
              item_name: anchor.dataset.analyticsItemName,
            },
          ],
        });
      }

      const eventName = getLeadClickEventName(href);

      if (!eventName) {
        return;
      }

      trackGoogleEvent(eventName, {
        page_path: window.location.pathname,
        placement: getClickPlacement(anchor),
      });
    }

    document.addEventListener("click", handleDocumentClick);

    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  useEffect(() => {
    if (mode !== "gtag" || !trackPageViews) {
      return;
    }

    trackGoogleEvent("page_view", {
      page_location: window.location.href,
      page_path: `${pathname}${search ? `?${search}` : ""}`,
      page_title: document.title,
    });
  }, [mode, pathname, search, trackPageViews]);

  return null;
}
