import {
  toGoogleConsentState,
  type GoogleConsentPreferences,
} from "@/src/modules/analytics/google-consent";

export type GoogleTagMode = "gtag" | "gtm";

export type GoogleAnalyticsItem = {
  affiliation?: string;
  coupon?: string;
  discount?: number;
  index?: number;
  item_brand?: string;
  item_category?: string;
  item_category2?: string;
  item_category3?: string;
  item_category4?: string;
  item_category5?: string;
  item_id: string;
  item_list_id?: string;
  item_list_name?: string;
  item_name: string;
  item_variant?: string;
  location_id?: string;
  price?: number;
  quantity?: number;
};

type CurrencyValue = {
  currency: string;
  value: number;
};

type CartEvent = CurrencyValue & {
  items: GoogleAnalyticsItem[];
};

type OptionalValueItemEvent = Partial<CurrencyValue> & {
  items: GoogleAnalyticsItem[];
};

export type GoogleAnalyticsEventParameters = {
  add_payment_info: CartEvent & {
    coupon?: string;
    payment_type?: string;
  };
  add_shipping_info: CartEvent & {
    coupon?: string;
    shipping_tier?: string;
  };
  add_to_cart: OptionalValueItemEvent;
  begin_checkout: CartEvent & { coupon?: string };
  directions_click: {
    page_path: string;
    placement: string;
  };
  email_click: {
    page_path: string;
    placement: string;
  };
  generate_lead: Partial<CurrencyValue> & {
    lead_source?: string;
  };
  page_view: {
    page_location: string;
    page_path: string;
    page_title: string;
  };
  phone_click: {
    page_path: string;
    placement: string;
  };
  purchase: CartEvent & {
    coupon?: string;
    shipping?: number;
    tax?: number;
    transaction_id: string;
  };
  remove_from_cart: CartEvent;
  search: { search_term: string };
  select_item: {
    item_list_id?: string;
    item_list_name?: string;
    items: GoogleAnalyticsItem[];
  };
  view_cart: CartEvent;
  view_item: CartEvent;
  view_item_list: {
    item_list_id?: string;
    item_list_name?: string;
    items: GoogleAnalyticsItem[];
  };
  whatsapp_click: {
    page_path: string;
    placement: string;
  };
};

export type GoogleAnalyticsEventName = keyof GoogleAnalyticsEventParameters;

type GoogleEventQueueEntry = {
  name: string;
  parameters: Record<string, unknown>;
};

type GoogleTagFunction = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GoogleTagFunction;
    jurgensGoogleAdsConversion?: { send_to: string };
    jurgensGoogleConsent?: {
      advertising: "denied" | "granted";
      analytics: "denied" | "granted";
    };
    jurgensGoogleEventQueue?: GoogleEventQueueEntry[];
    jurgensGoogleTagMode?: GoogleTagMode;
    jurgensGoogleTagsReady?: boolean;
  }
}

function dispatchGoogleEvent(entry: GoogleEventQueueEntry) {
  if (typeof window === "undefined") {
    return;
  }

  if (window.jurgensGoogleTagMode === "gtm") {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({
      event: entry.name,
      ...entry.parameters,
    });
    return;
  }

  window.gtag?.("event", entry.name, entry.parameters);
}

export function flushGoogleEventQueue() {
  if (typeof window === "undefined" || !window.jurgensGoogleTagsReady) {
    return;
  }

  const queue = window.jurgensGoogleEventQueue ?? [];
  window.jurgensGoogleEventQueue = [];
  queue.forEach(dispatchGoogleEvent);
}

function trackGoogleEventEntry(entry: GoogleEventQueueEntry) {
  if (typeof window === "undefined") {
    return;
  }

  if (!window.jurgensGoogleTagMode || !window.jurgensGoogleTagsReady) {
    window.jurgensGoogleEventQueue = window.jurgensGoogleEventQueue ?? [];
    window.jurgensGoogleEventQueue.push(entry);
    return;
  }

  flushGoogleEventQueue();
  dispatchGoogleEvent(entry);
}

export function trackGoogleEvent<Name extends GoogleAnalyticsEventName>(
  name: Name,
  parameters: GoogleAnalyticsEventParameters[Name],
) {
  trackGoogleEventEntry({
    name,
    parameters: parameters as Record<string, unknown>,
  });
}

export function trackCustomGoogleEvent(
  name: string,
  parameters: Record<string, unknown> = {},
) {
  trackGoogleEventEntry({ name, parameters });
}

export function trackGoogleAdsConversion(parameters: {
  currency?: string;
  transaction_id?: string;
  value?: number;
}) {
  if (typeof window === "undefined") {
    return;
  }

  const sendTo = window.jurgensGoogleAdsConversion?.send_to;
  if (!sendTo) {
    return;
  }

  trackGoogleEventEntry({
    name:
      window.jurgensGoogleTagMode === "gtm"
        ? "google_ads_conversion"
        : "conversion",
    parameters: {
      ...parameters,
      send_to: sendTo,
    },
  });
}

export function updateGoogleConsent(preferences: GoogleConsentPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  const state = toGoogleConsentState(preferences);
  window.gtag?.("consent", "update", state);
  window.gtag?.("set", "ads_data_redaction", !preferences.advertising);
  window.jurgensGoogleConsent = {
    advertising: state.ad_storage,
    analytics: state.analytics_storage,
  };
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({
    advertising_consent: state.ad_storage,
    analytics_consent: state.analytics_storage,
    event: "jurgens_consent_update",
  });
  window.dispatchEvent(
    new CustomEvent("jurgens:google-consent-update", {
      detail: preferences,
    }),
  );
}
