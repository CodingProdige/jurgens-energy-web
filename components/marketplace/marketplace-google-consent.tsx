"use client";

import Link from "next/link";
import { Cookie, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  googleConsentVersion,
  readGoogleConsentPreferencesFromDocument,
  writeGoogleConsentPreferencesToDocument,
  type GoogleConsentPreferences,
} from "@/src/modules/analytics/google-consent";
import { updateGoogleConsent } from "@/src/modules/analytics/google";

const rejectedPreferences: GoogleConsentPreferences = {
  advertising: false,
  analytics: false,
  version: googleConsentVersion,
};

const acceptedPreferences: GoogleConsentPreferences = {
  advertising: true,
  analytics: true,
  version: googleConsentVersion,
};

const googleAnalyticsCookiePrefixes = ["_ga", "_gid", "_gat"];
const googleAdvertisingCookiePrefixes = ["_gac_", "_gcl_"];

const attributionQueryParameters = {
  gbraid: "gbraid",
  gclid: "gclid",
  utm_campaign: "utmCampaign",
  utm_content: "utmContent",
  utm_id: "utmId",
  utm_medium: "utmMedium",
  utm_source: "utmSource",
  utm_term: "utmTerm",
  wbraid: "wbraid",
} as const;

function captureCampaignAttribution() {
  const searchParams = new URLSearchParams(window.location.search);
  const attribution = Object.entries(attributionQueryParameters).reduce<
    Record<string, string>
  >((result, [queryName, fieldName]) => {
    const value = searchParams.get(queryName)?.trim();

    if (value) {
      result[fieldName] = value;
    }

    return result;
  }, {});

  if (Object.keys(attribution).length === 0) {
    return;
  }

  void fetch("/api/marketing/attribution", {
    body: JSON.stringify(attribution),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  });
}

function clearCampaignAttribution() {
  void fetch("/api/marketing/attribution", {
    credentials: "same-origin",
    keepalive: true,
    method: "DELETE",
  });
}

function clearGoogleMeasurementCookies({
  advertising,
  analytics,
}: {
  advertising: boolean;
  analytics: boolean;
}) {
  const prefixes = [
    ...(analytics ? googleAnalyticsCookiePrefixes : []),
    ...(advertising ? googleAdvertisingCookiePrefixes : []),
  ];
  const names = document.cookie
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter((name) => prefixes.some((prefix) => name.startsWith(prefix)));
  const hostname = window.location.hostname;
  const domainParts = hostname.split(".");
  const registrableDomain =
    domainParts.length > 2 ? `.${domainParts.slice(-2).join(".")}` : null;

  for (const name of names) {
    const base = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    document.cookie = base;
    document.cookie = `${base}; Domain=${hostname}`;
    if (registrableDomain) {
      document.cookie = `${base}; Domain=${registrableDomain}`;
    }
  }
}

export function MarketplaceGoogleConsent() {
  const [preferences, setPreferences] =
    useState<GoogleConsentPreferences | null>();
  const [draft, setDraft] = useState<GoogleConsentPreferences>(
    rejectedPreferences,
  );
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const stored = readGoogleConsentPreferencesFromDocument();
    setPreferences(stored);
    setDraft(stored ?? rejectedPreferences);

    if (stored?.advertising) {
      captureCampaignAttribution();
    }
  }, []);

  function openPreferences() {
    setDraft(preferences ?? rejectedPreferences);
    setPreferencesOpen(true);
  }

  function savePreferences(next: GoogleConsentPreferences) {
    const analyticsWithdrawn = Boolean(
      preferences?.analytics && !next.analytics,
    );
    const advertisingWithdrawn = Boolean(
      preferences?.advertising && !next.advertising,
    );

    if (analyticsWithdrawn || advertisingWithdrawn) {
      clearGoogleMeasurementCookies({
        advertising: advertisingWithdrawn,
        analytics: analyticsWithdrawn,
      });
    }

    writeGoogleConsentPreferencesToDocument(next);
    updateGoogleConsent(next);

    if (next.advertising) {
      captureCampaignAttribution();
    } else {
      clearCampaignAttribution();
    }

    setPreferences(next);
    setDraft(next);
    setPreferencesOpen(false);
  }

  if (preferences === undefined) {
    return null;
  }

  return (
    <>
      {preferences === null ? (
        <section
          aria-label="Cookie consent"
          className="fixed inset-x-3 bottom-3 z-[60] mx-auto grid max-w-4xl gap-4 rounded-2xl border border-[#e3e3dc] bg-white p-4 text-[#1a1a1a] shadow-[0_20px_60px_rgba(8,8,8,0.24)] dark:border-white/15 dark:bg-[#101010] dark:text-[#f7f7f2] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:p-5"
        >
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f]">
                <Cookie aria-hidden="true" className="size-4" />
              </span>
              <h2 className="font-heading text-base font-bold">
                Your privacy choices
              </h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-[#5c5c57] dark:text-[#c8c8c0]">
              Essential cookies keep the store secure and working. With your
              permission, analytics helps us improve the shop and advertising
              helps us understand which campaigns lead to orders. Read our{" "}
              <Link
                className="font-semibold text-[#d94514] underline underline-offset-3 dark:text-[#ff7b4a]"
                href="/privacy-policy"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2 sm:max-w-[22rem] sm:justify-end">
            <Button
              className="min-w-0 flex-1 sm:flex-none"
              onClick={() => savePreferences(rejectedPreferences)}
              type="button"
              variant="outline"
            >
              Reject optional
            </Button>
            <Button
              className="min-w-0 flex-1 sm:flex-none"
              onClick={openPreferences}
              type="button"
              variant="outline"
            >
              Choose settings
            </Button>
            <Button
              className="min-w-0 flex-1 bg-[#ff5a1f] text-white hover:bg-[#d94514] sm:flex-none"
              onClick={() => savePreferences(acceptedPreferences)}
              type="button"
            >
              Accept all
            </Button>
          </div>
        </section>
      ) : (
        <Button
          className="fixed bottom-3 left-3 z-40 border-[#d7d7d0] bg-white/95 text-[#1a1a1a] shadow-md backdrop-blur hover:bg-[#f7f7f2] dark:border-white/15 dark:bg-[#101010]/95 dark:text-[#f7f7f2] dark:hover:bg-[#1a1a1a]"
          onClick={openPreferences}
          size="sm"
          type="button"
          variant="outline"
        >
          <Cookie aria-hidden="true" />
          Cookie settings
        </Button>
      )}

      <Dialog onOpenChange={setPreferencesOpen} open={preferencesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <ShieldCheck aria-hidden="true" className="size-5 text-[#ff5a1f]" />
              Cookie preferences
            </DialogTitle>
            <DialogDescription>
              Choose the optional measurement you allow. You can return to
              these settings at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            <label className="flex items-start gap-3 rounded-xl border border-[#e3e3dc] p-3 dark:border-white/10">
              <Checkbox checked disabled className="mt-0.5" />
              <span className="min-w-0">
                <span className="block font-semibold">Essential</span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                  Required for security, sign-in, checkout, cart contents and
                  saved preferences. These cannot be switched off.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e3e3dc] p-3 dark:border-white/10">
              <Checkbox
                checked={draft.analytics}
                className="mt-0.5"
                onCheckedChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    analytics: checked === true,
                  }))
                }
              />
              <span className="min-w-0">
                <span className="block font-semibold">Analytics</span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                  Measures visits, product activity and completed purchases so
                  we can improve the store.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e3e3dc] p-3 dark:border-white/10">
              <Checkbox
                checked={draft.advertising}
                className="mt-0.5"
                onCheckedChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    advertising: checked === true,
                  }))
                }
              />
              <span className="min-w-0">
                <span className="block font-semibold">Advertising</span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                  Helps us measure advertising performance and, where enabled,
                  show more relevant promotions.
                </span>
              </span>
            </label>
          </DialogBody>
          <DialogFooter className="flex-col sm:flex-row">
            <Button
              onClick={() => savePreferences(rejectedPreferences)}
              type="button"
              variant="outline"
            >
              Reject optional
            </Button>
            <Button
              onClick={() => savePreferences(draft)}
              type="button"
            >
              Save choices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
