export const googleConsentCookieName = "jurgens_google_consent";
export const googleConsentCookieMaxAgeSeconds = 60 * 60 * 24 * 180;
export const googleConsentVersion = 1 as const;

export type GoogleConsentPreferences = {
  advertising: boolean;
  analytics: boolean;
  version: typeof googleConsentVersion;
};

export type GoogleConsentState = {
  ad_personalization: "denied" | "granted";
  ad_storage: "denied" | "granted";
  ad_user_data: "denied" | "granted";
  analytics_storage: "denied" | "granted";
  functionality_storage: "granted";
  personalization_storage: "denied";
  security_storage: "granted";
};

const deniedPreferences: GoogleConsentPreferences = {
  advertising: false,
  analytics: false,
  version: googleConsentVersion,
};

export function parseGoogleConsentPreferences(
  value: string | null | undefined,
): GoogleConsentPreferences | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as {
      a?: unknown;
      d?: unknown;
      v?: unknown;
    };

    if (
      parsed.v !== googleConsentVersion ||
      typeof parsed.a !== "boolean" ||
      typeof parsed.d !== "boolean"
    ) {
      return null;
    }

    return {
      advertising: parsed.d,
      analytics: parsed.a,
      version: googleConsentVersion,
    };
  } catch {
    return null;
  }
}

export function serializeGoogleConsentPreferences(
  preferences: GoogleConsentPreferences,
) {
  return encodeURIComponent(
    JSON.stringify({
      a: preferences.analytics,
      d: preferences.advertising,
      v: googleConsentVersion,
    }),
  );
}

export function toGoogleConsentState(
  preferences: GoogleConsentPreferences | null,
): GoogleConsentState {
  const resolved = preferences ?? deniedPreferences;

  return {
    ad_personalization: resolved.advertising ? "granted" : "denied",
    ad_storage: resolved.advertising ? "granted" : "denied",
    ad_user_data: resolved.advertising ? "granted" : "denied",
    analytics_storage: resolved.analytics ? "granted" : "denied",
    functionality_storage: "granted",
    personalization_storage: "denied",
    security_storage: "granted",
  };
}

export function readGoogleConsentPreferencesFromDocument() {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${googleConsentCookieName}=`;
  const rawValue = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);

  return parseGoogleConsentPreferences(rawValue);
}

export function writeGoogleConsentPreferencesToDocument(
  preferences: GoogleConsentPreferences,
) {
  if (typeof document === "undefined") {
    return;
  }

  const secure = window.location.protocol === "https:" ? "Secure" : "";
  document.cookie = [
    `${googleConsentCookieName}=${serializeGoogleConsentPreferences(preferences)}`,
    "Path=/",
    `Max-Age=${googleConsentCookieMaxAgeSeconds}`,
    "SameSite=Lax",
    secure,
  ]
    .filter(Boolean)
    .join("; ");
}

export function buildGoogleConsentDefaultsScript() {
  const cookieName = JSON.stringify(googleConsentCookieName);
  const version = JSON.stringify(googleConsentVersion);

  return `(function(w,d){
  w.dataLayer=w.dataLayer||[];
  w.gtag=w.gtag||function(){w.dataLayer.push(arguments);};
  var preferences=null;
  try {
    var prefix=${cookieName}+'=';
    var raw=d.cookie.split(';').map(function(part){return part.trim();}).find(function(part){return part.indexOf(prefix)===0;});
    if(raw){
      var parsed=JSON.parse(decodeURIComponent(raw.slice(prefix.length)));
      if(parsed.v===${version}&&typeof parsed.a==='boolean'&&typeof parsed.d==='boolean'){
        preferences={analytics:parsed.a,advertising:parsed.d};
      }
    }
  } catch(error) {}
  var analytics=preferences&&preferences.analytics?'granted':'denied';
  var advertising=preferences&&preferences.advertising?'granted':'denied';
  w.jurgensGoogleConsent={analytics:analytics,advertising:advertising};
  w.gtag('consent','default',{
    ad_storage:advertising,
    analytics_storage:analytics,
    ad_user_data:advertising,
    ad_personalization:advertising,
    functionality_storage:'granted',
    personalization_storage:'denied',
    security_storage:'granted',
    wait_for_update:500
  });
  w.gtag('set','ads_data_redaction',advertising==='denied');
  w.gtag('set','url_passthrough',true);
})(window,document);`;
}
