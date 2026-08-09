"use client";

import { Loader2Icon, MessagesSquareIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { getTidioScriptUrl } from "@/src/modules/marketplace/tidio";

type TidioChatApi = {
  hide: () => void;
  off?: (event: "ready", callback: () => void) => void;
  on: (event: "close" | "ready", callback: () => void) => void;
  open: () => void;
  show: () => void;
};

type TidioWindow = Window & {
  tidioChatApi?: TidioChatApi;
};

type TidioLoadState = {
  promise: Promise<TidioChatApi>;
  scriptUrl: string;
};

const tidioScriptId = "marketplace-tidio-script";
const tidioReadyEvent = "tidioChat-ready";
const tidioLoadTimeoutMs = 15_000;
const configuredApis = new WeakSet<TidioChatApi>();
const sensitiveTidioPathPrefixes = [
  "/account",
  "/auth",
  "/checkout",
  "/forgot-password",
  "/register",
  "/reset-password",
  "/sign-in",
  "/whatsapp/resume",
] as const;
let tidioLoadState: TidioLoadState | null = null;
let mountedTidioLaunchers = 0;

function getTidioApi() {
  return (window as TidioWindow).tidioChatApi ?? null;
}

function configureTidioApi(api: TidioChatApi) {
  if (configuredApis.has(api)) {
    return;
  }

  api.hide();
  api.on("close", () => {
    api.hide();
  });
  configuredApis.add(api);
}

function isSensitiveTidioDestination(url: URL) {
  return sensitiveTidioPathPrefixes.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
  );
}

function loadTidio(scriptUrl: string) {
  const existingApi = getTidioApi();
  const existingScript = document.getElementById(tidioScriptId);

  if (existingApi) {
    if (
      !(existingScript instanceof HTMLScriptElement) ||
      existingScript.src !== scriptUrl
    ) {
      return Promise.reject(
        new Error(
          "The loaded Tidio project differs from the configured project. Reload the page before opening chat.",
        ),
      );
    }

    return Promise.resolve(existingApi);
  }

  if (tidioLoadState?.scriptUrl === scriptUrl) {
    return tidioLoadState.promise;
  }

  if (tidioLoadState) {
    return Promise.reject(
      new Error("A different Tidio project is already loading."),
    );
  }

  const promise = new Promise<TidioChatApi>((resolve, reject) => {
    let isSettled = false;
    const script =
      existingScript instanceof HTMLScriptElement
        ? existingScript
        : document.createElement("script");

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener(tidioReadyEvent, handleReady);
      script.removeEventListener("error", handleError);
      script.removeEventListener("load", handleLoad);

      const api = getTidioApi();
      api?.off?.("ready", handleReady);
    };

    const complete = (api: TidioChatApi) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      cleanup();
      resolve(api);
    };

    function handleReady() {
      const api = getTidioApi();

      if (api) {
        complete(api);
      }
    }

    function handleError() {
      if (isSettled) {
        return;
      }

      isSettled = true;
      cleanup();
      reject(new Error("Tidio could not be loaded."));
    }

    function handleLoad() {
      const api = getTidioApi();

      if (api) {
        api.on("ready", handleReady);
      }
    }

    const timeoutId = window.setTimeout(() => {
      handleError();
    }, tidioLoadTimeoutMs);

    document.addEventListener(tidioReadyEvent, handleReady);
    script.addEventListener("error", handleError);
    script.addEventListener("load", handleLoad);

    if (!existingScript) {
      script.async = true;
      script.id = tidioScriptId;
      script.referrerPolicy = "strict-origin-when-cross-origin";
      script.src = scriptUrl;
      document.body.append(script);
    } else if (script.src !== scriptUrl) {
      handleError();
    }
  });

  tidioLoadState = { promise, scriptUrl };
  void promise.catch(() => {
    if (tidioLoadState?.promise === promise) {
      tidioLoadState = null;
    }

    const failedScript = document.getElementById(tidioScriptId);

    if (!getTidioApi() && failedScript instanceof HTMLScriptElement) {
      failedScript.remove();
    }
  });

  return promise;
}

export function MarketplaceTidioButton({ publicKey }: { publicKey: string }) {
  const scriptUrl = getTidioScriptUrl(publicKey);
  const [status, setStatus] = useState<"error" | "idle" | "loading" | "ready">(
    "idle",
  );
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedTidioLaunchers += 1;
    mountedRef.current = true;

    return () => {
      mountedTidioLaunchers = Math.max(0, mountedTidioLaunchers - 1);
      mountedRef.current = false;
      requestIdRef.current += 1;

      window.setTimeout(() => {
        if (mountedTidioLaunchers === 0) {
          getTidioApi()?.hide();
        }
      }, 0);
    };
  }, []);

  useEffect(() => {
    function forceCleanNavigationToSensitiveSurface(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }

      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");

      if (
        !anchor ||
        anchor.download ||
        (anchor.target && anchor.target !== "_self")
      ) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);

      if (
        destination.origin !== window.location.origin ||
        !isSensitiveTidioDestination(destination)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.location.assign(destination.href);
    }

    document.addEventListener(
      "click",
      forceCleanNavigationToSensitiveSurface,
      true,
    );

    return () => {
      document.removeEventListener(
        "click",
        forceCleanNavigationToSensitiveSurface,
        true,
      );
    };
  }, []);

  if (!scriptUrl) {
    return null;
  }

  const validatedScriptUrl = scriptUrl;

  async function openChat() {
    if (status === "loading") {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus("loading");

    try {
      const api = await loadTidio(validatedScriptUrl);

      if (!mountedRef.current || requestIdRef.current !== requestId) {
        api.hide();
        return;
      }

      configureTidioApi(api);
      api.show();
      api.open();

      setStatus("ready");
    } catch {
      if (mountedRef.current && requestIdRef.current === requestId) {
        setStatus("error");
      }
    }
  }

  const isLoading = status === "loading";
  const label =
    status === "error"
      ? "Try live chat again"
      : isLoading
        ? "Loading live chat"
        : "Chat with Jurgens Energy";

  return (
    <div
      className="fixed right-5 bottom-5 z-[45] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 max-[520px]:right-4 max-[520px]:bottom-4"
      data-marketplace-support-button
      data-marketplace-tidio-button
    >
      {status === "error" ? (
        <p
          className="max-w-64 rounded-xl border border-white/10 bg-[#080808] px-3 py-2 text-right text-xs text-white shadow-xl"
          role="alert"
        >
          Live chat could not load. Check your connection and try again.
        </p>
      ) : null}
      <button
        aria-busy={isLoading}
        aria-label={label}
        className="group relative inline-flex h-14 items-center gap-2.5 overflow-hidden rounded-full bg-[#080808] px-5 text-sm font-normal uppercase text-white shadow-[0_14px_30px_rgba(8,8,8,0.24),0_0_16px_rgba(255,90,31,0.12)] ring-1 ring-[#ff5a1f]/15 transition hover:bg-[#1a1a1a] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/30 disabled:cursor-wait disabled:opacity-80 max-[520px]:size-14 max-[520px]:justify-center max-[520px]:px-0"
        data-marketplace-tidio-launcher
        disabled={isLoading}
        onClick={openChat}
        type="button"
      >
        <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover:translate-x-[300%]" />
        {isLoading ? (
          <Loader2Icon
            aria-hidden="true"
            className="relative z-10 size-6 animate-spin text-[#ffb000]"
          />
        ) : (
          <MessagesSquareIcon
            aria-hidden="true"
            className="relative z-10 size-6 text-[#ff5a1f]"
          />
        )}
        <span className="relative z-10 max-[520px]:sr-only">
          {status === "error" ? "Try again" : isLoading ? "Loading…" : "Live chat"}
        </span>
      </button>
      <span aria-live="polite" className="sr-only" role="status">
        {status === "error"
          ? "Live chat could not be loaded."
          : isLoading
            ? "Live chat is loading."
            : ""}
      </span>
    </div>
  );
}
