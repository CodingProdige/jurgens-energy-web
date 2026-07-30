"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { LoaderCircleIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

const MINIMUM_QUERY_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 300;
const REQUEST_TIMEOUT_MS = 8_000;

export type GooglePlacesSuggestion = {
  mainText: string;
  placeId: string;
  secondaryText: string;
  text: string;
};

export type GooglePlacesResolvedAddress = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  countryCode: string;
  formattedAddress: string;
  placeId: string;
  postalCode: string;
  province: string;
  suburb: string;
};

export type GooglePlacesAddressAutocompleteProps = {
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  autoComplete?: string;
  countryCode: string;
  disabled?: boolean;
  id: string;
  inputClassName?: string;
  leadingIcon?: ReactNode;
  maxLength?: number;
  name?: string;
  onAddressSelect: (address: GooglePlacesResolvedAddress) => void;
  onResolvingChange?: (resolving: boolean) => void;
  onValueChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
};

type ErrorResponse = {
  message?: unknown;
};

function createSessionToken() {
  return globalThis.crypto.randomUUID();
}

function isSuggestion(value: unknown): value is GooglePlacesSuggestion {
  if (!value || typeof value !== "object") {
    return false;
  }

  const suggestion = value as Partial<GooglePlacesSuggestion>;

  return (
    typeof suggestion.mainText === "string" &&
    typeof suggestion.placeId === "string" &&
    typeof suggestion.secondaryText === "string" &&
    typeof suggestion.text === "string"
  );
}

function isResolvedAddress(
  value: unknown,
): value is GooglePlacesResolvedAddress {
  if (!value || typeof value !== "object") {
    return false;
  }

  const address = value as Partial<GooglePlacesResolvedAddress>;

  return (
    typeof address.addressLine1 === "string" &&
    typeof address.addressLine2 === "string" &&
    typeof address.city === "string" &&
    typeof address.countryCode === "string" &&
    typeof address.formattedAddress === "string" &&
    typeof address.placeId === "string" &&
    typeof address.postalCode === "string" &&
    typeof address.province === "string" &&
    typeof address.suburb === "string"
  );
}

function responseMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const message = (value as ErrorResponse).message;

  return typeof message === "string" && message.trim() ? message : fallback;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function GooglePlacesAddressAutocomplete({
  ariaDescribedBy,
  ariaInvalid,
  autoComplete = "address-line1",
  countryCode,
  disabled = false,
  id,
  inputClassName,
  leadingIcon,
  maxLength = 240,
  name,
  onAddressSelect,
  onResolvingChange,
  onValueChange,
  placeholder = "Start typing a street address",
  required = false,
  value,
}: GooglePlacesAddressAutocompleteProps) {
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [open, setOpen] = useState(false);
  const [providerDisabled, setProviderDisabled] = useState(false);
  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GooglePlacesSuggestion[]>([]);
  const autocompleteControllerRef = useRef<AbortController | null>(null);
  const autocompleteRequestIdRef = useRef(0);
  const detailsControllerRef = useRef<AbortController | null>(null);
  const detailsRequestIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastEmittedValueRef = useRef(value);
  const onResolvingChangeRef = useRef(onResolvingChange);
  const previousCountryCodeRef = useRef(countryCode);
  const resolvingStateRef = useRef(false);
  const sessionTokenRef = useRef<string | null>(null);
  const trimmedSearchQuery = searchQuery?.trim() ?? "";
  const isResolving = resolvingPlaceId !== null;
  const isBusy = isLoading || isResolving;
  const disclosureId = `${id}-places-disclosure`;
  const errorId = `${id}-places-error`;
  const describedBy = [ariaDescribedBy, disclosureId, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  onResolvingChangeRef.current = onResolvingChange;

  const updateResolvingState = useCallback((placeId: string | null) => {
    const nextResolving = placeId !== null;

    setResolvingPlaceId(placeId);
    inputRef.current?.setCustomValidity(
      nextResolving
        ? "Please wait for the selected address to finish loading."
        : "",
    );

    if (resolvingStateRef.current !== nextResolving) {
      resolvingStateRef.current = nextResolving;
      onResolvingChangeRef.current?.(nextResolving);
    }
  }, []);

  const cancelDetailsRequest = useCallback(() => {
    detailsControllerRef.current?.abort();
    detailsControllerRef.current = null;
    detailsRequestIdRef.current += 1;
    updateResolvingState(null);
  }, [updateResolvingState]);

  useEffect(() => {
    if (value === lastEmittedValueRef.current) {
      return;
    }

    autocompleteControllerRef.current?.abort();
    autocompleteControllerRef.current = null;
    autocompleteRequestIdRef.current += 1;
    cancelDetailsRequest();
    setAnnouncement("");
    setError(null);
    setHasSearched(false);
    setIsLoading(false);
    setOpen(false);
    setSearchQuery(null);
    setSuggestions([]);
    sessionTokenRef.current = null;
    lastEmittedValueRef.current = value;
  }, [cancelDetailsRequest, value]);

  useEffect(() => {
    if (previousCountryCodeRef.current === countryCode) {
      return;
    }

    previousCountryCodeRef.current = countryCode;
    autocompleteControllerRef.current?.abort();
    autocompleteControllerRef.current = null;
    autocompleteRequestIdRef.current += 1;
    cancelDetailsRequest();
    setAnnouncement("");
    setError(null);
    setHasSearched(false);
    setIsLoading(false);
    setOpen(false);
    setSearchQuery(null);
    setSuggestions([]);
    sessionTokenRef.current = null;
  }, [cancelDetailsRequest, countryCode]);

  useEffect(() => {
    if (!disabled) {
      return;
    }

    autocompleteControllerRef.current?.abort();
    autocompleteControllerRef.current = null;
    autocompleteRequestIdRef.current += 1;
    cancelDetailsRequest();
    setAnnouncement("");
    setError(null);
    setHasSearched(false);
    setIsLoading(false);
    setOpen(false);
    setSearchQuery(null);
    setSuggestions([]);
    sessionTokenRef.current = null;
  }, [cancelDetailsRequest, disabled]);

  useEffect(() => {
    if (
      disabled ||
      manualMode ||
      providerDisabled ||
      !searchQuery ||
      trimmedSearchQuery.length < MINIMUM_QUERY_LENGTH
    ) {
      autocompleteControllerRef.current?.abort();
      autocompleteControllerRef.current = null;
      autocompleteRequestIdRef.current += 1;
      setIsLoading(false);
      setSuggestions([]);

      if (!trimmedSearchQuery) {
        setError(null);
        setHasSearched(false);
        sessionTokenRef.current = null;
      }

      return;
    }

    const requestId = autocompleteRequestIdRef.current + 1;
    autocompleteRequestIdRef.current = requestId;
    const controller = new AbortController();
    autocompleteControllerRef.current?.abort();
    autocompleteControllerRef.current = controller;
    let didTimeout = false;
    let requestTimeout: number | null = null;

    const debounceTimeout = window.setTimeout(async () => {
      setError(null);
      setHasSearched(false);
      setIsLoading(true);

      if (!sessionTokenRef.current) {
        sessionTokenRef.current = createSessionToken();
      }

      requestTimeout = window.setTimeout(() => {
        didTimeout = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch("/api/places/autocomplete", {
          body: JSON.stringify({
            countryCode: countryCode.trim().toUpperCase(),
            input: trimmedSearchQuery,
            sessionToken: sessionTokenRef.current,
          }),
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });
        const result = await readJson(response);

        if (
          controller.signal.aborted ||
          requestId !== autocompleteRequestIdRef.current
        ) {
          return;
        }

        if (!response.ok) {
          const message = responseMessage(
            result,
            "Address suggestions are unavailable. Continue entering the address manually.",
          );

          setSuggestions([]);
          setError(message);
          setAnnouncement(message);
          setHasSearched(true);
          return;
        }

        if (
          result &&
          typeof result === "object" &&
          (result as { enabled?: unknown }).enabled === false
        ) {
          setProviderDisabled(true);
          setOpen(false);
          setSuggestions([]);
          setError(null);
          setAnnouncement("");
          setHasSearched(false);
          setIsLoading(false);
          return;
        }

        const nextSuggestions =
          result &&
          typeof result === "object" &&
          Array.isArray(
            (result as { suggestions?: unknown }).suggestions,
          )
            ? (result as { suggestions: unknown[] }).suggestions.filter(
                isSuggestion,
              )
            : [];

        setSuggestions(nextSuggestions);
        setHasSearched(true);
        setAnnouncement(
          nextSuggestions.length > 0
            ? `${nextSuggestions.length} address suggestion${
                nextSuggestions.length === 1 ? "" : "s"
              } available.`
            : "No matching addresses found. Continue entering the address manually.",
        );
      } catch (requestError) {
        if (
          requestId !== autocompleteRequestIdRef.current ||
          (requestError as Error).name === "AbortError" && !didTimeout
        ) {
          return;
        }

        setSuggestions([]);
        const message = didTimeout
          ? "Address suggestions took too long. Continue entering the address manually."
          : "Address suggestions are unavailable. Continue entering the address manually.";

        setError(message);
        setAnnouncement(message);
        setHasSearched(true);
      } finally {
        if (requestTimeout !== null) {
          window.clearTimeout(requestTimeout);
        }

        if (requestId === autocompleteRequestIdRef.current) {
          autocompleteControllerRef.current = null;
          setIsLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(debounceTimeout);

      if (requestTimeout !== null) {
        window.clearTimeout(requestTimeout);
      }

      controller.abort();
    };
  }, [
    countryCode,
    disabled,
    manualMode,
    providerDisabled,
    searchQuery,
    trimmedSearchQuery,
  ]);

  useEffect(
    () => () => {
      autocompleteControllerRef.current?.abort();
      detailsControllerRef.current?.abort();
      autocompleteRequestIdRef.current += 1;
      detailsRequestIdRef.current += 1;
      inputRef.current?.setCustomValidity("");

      if (resolvingStateRef.current) {
        resolvingStateRef.current = false;
        onResolvingChangeRef.current?.(false);
      }
    },
    [],
  );

  function emitValue(nextValue: string) {
    lastEmittedValueRef.current = nextValue;
    onValueChange(nextValue);
  }

  function cancelPendingRequests() {
    autocompleteControllerRef.current?.abort();
    autocompleteControllerRef.current = null;
    autocompleteRequestIdRef.current += 1;
    cancelDetailsRequest();
  }

  function enableManualEntry() {
    cancelPendingRequests();
    setAnnouncement(
      "Manual address entry enabled. What you type will not be sent to Google Maps.",
    );
    setError(null);
    setHasSearched(false);
    setIsLoading(false);
    setManualMode(true);
    setOpen(false);
    setSearchQuery(null);
    setSuggestions([]);
    sessionTokenRef.current = null;
  }

  function enableAddressSearch() {
    const nextQuery = value.trim();

    cancelPendingRequests();
    setAnnouncement(
      "Address search enabled. Suggestions are provided by Google Maps.",
    );
    setError(null);
    setHasSearched(false);
    setIsLoading(nextQuery.length >= MINIMUM_QUERY_LENGTH);
    setManualMode(false);
    setOpen(nextQuery.length > 0);
    setSearchQuery(value);
    setSuggestions([]);
    sessionTokenRef.current = null;
  }

  async function selectSuggestion(suggestion: GooglePlacesSuggestion) {
    autocompleteControllerRef.current?.abort();
    autocompleteControllerRef.current = null;
    autocompleteRequestIdRef.current += 1;
    cancelDetailsRequest();

    const requestId = detailsRequestIdRef.current + 1;
    detailsRequestIdRef.current = requestId;
    const controller = new AbortController();
    detailsControllerRef.current = controller;
    const activeSessionToken =
      sessionTokenRef.current ?? createSessionToken();
    let didTimeout = false;
    const requestTimeout = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    setError(null);
    setAnnouncement("Completing the selected address.");
    setIsLoading(false);
    setOpen(false);
    lastEmittedValueRef.current =
      suggestion.mainText || suggestion.text;
    onAddressSelect({
      addressLine1: suggestion.mainText || suggestion.text,
      addressLine2: "",
      city: "",
      countryCode: countryCode.trim().toUpperCase(),
      formattedAddress: suggestion.text,
      placeId: suggestion.placeId,
      postalCode: "",
      province: "",
      suburb: "",
    });
    updateResolvingState(suggestion.placeId);
    setSearchQuery(null);
    setSuggestions([]);

    try {
      const response = await fetch("/api/places/details", {
        body: JSON.stringify({
          countryCode: countryCode.trim().toUpperCase(),
          placeId: suggestion.placeId,
          sessionToken: activeSessionToken,
        }),
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: controller.signal,
      });
      const result = await readJson(response);

      if (
        controller.signal.aborted ||
        requestId !== detailsRequestIdRef.current
      ) {
        return;
      }

      const address =
        result && typeof result === "object"
          ? (result as { address?: unknown }).address
          : null;

      if (!response.ok || !isResolvedAddress(address)) {
        const message = responseMessage(
          result,
          "That suggestion could not be completed. Review and finish the address manually.",
        );

        emitValue(suggestion.mainText || suggestion.text);
        setError(message);
        setAnnouncement(message);
        return;
      }

      lastEmittedValueRef.current = address.addressLine1;
      onAddressSelect(address);
      setError(null);
      setHasSearched(false);
      setAnnouncement(
        "Address filled automatically. Review the completed address fields.",
      );
    } catch (requestError) {
      if (
        requestId !== detailsRequestIdRef.current ||
        (requestError as Error).name === "AbortError" && !didTimeout
      ) {
        return;
      }

      const message = didTimeout
        ? "Completing that address took too long. Review and finish it manually."
        : "That suggestion could not be completed. Review and finish the address manually.";

      emitValue(suggestion.mainText || suggestion.text);
      setError(message);
      setAnnouncement(message);
    } finally {
      window.clearTimeout(requestTimeout);

      if (requestId === detailsRequestIdRef.current) {
        detailsControllerRef.current = null;
        updateResolvingState(null);
        sessionTokenRef.current = createSessionToken();
      }
    }
  }

  let statusMessage: string | null = null;

  if (isResolving) {
    statusMessage = "Completing the selected address…";
  } else if (isLoading) {
    statusMessage = "Searching Google Maps…";
  } else if (error) {
    statusMessage = error;
  } else if (
    searchQuery &&
    trimmedSearchQuery.length > 0 &&
    trimmedSearchQuery.length < MINIMUM_QUERY_LENGTH
  ) {
    statusMessage = `Enter at least ${MINIMUM_QUERY_LENGTH} characters to search.`;
  } else if (
    hasSearched &&
    trimmedSearchQuery.length >= MINIMUM_QUERY_LENGTH &&
    suggestions.length === 0
  ) {
    statusMessage =
      "No matching addresses found. Continue entering the address manually.";
  }

  return (
    <div className="grid min-w-0 gap-1.5">
      <Autocomplete.Root
        autoHighlight
        disabled={disabled}
        itemToStringValue={(suggestion: GooglePlacesSuggestion) =>
          suggestion.text
        }
        items={suggestions}
        mode="none"
        onOpenChange={(nextOpen) => setOpen(nextOpen)}
        onValueChange={(nextValue, details) => {
          if (details.reason === "item-press") {
            return;
          }

          cancelPendingRequests();
          emitValue(nextValue);
          setAnnouncement("");
          setError(null);
          setHasSearched(false);
          setSuggestions([]);

          if (manualMode || providerDisabled) {
            setIsLoading(false);
            setOpen(false);
            setSearchQuery(null);
            return;
          }

          const nextQueryLength = nextValue.trim().length;

          if (nextQueryLength === 0) {
            sessionTokenRef.current = null;
          }

          setIsLoading(nextQueryLength >= MINIMUM_QUERY_LENGTH);
          setSearchQuery(nextValue);
          setOpen(nextQueryLength > 0);
        }}
        open={open && !disabled && !manualMode && !providerDisabled}
        openOnInputClick={
          !manualMode && !providerDisabled && suggestions.length > 0
        }
        value={value}
      >
        <Autocomplete.InputGroup className="relative min-w-0">
          {leadingIcon ? (
            <span className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-muted-foreground">
              {leadingIcon}
            </span>
          ) : null}
          <Autocomplete.Input
            aria-busy={isBusy || undefined}
            aria-describedby={describedBy || undefined}
            aria-invalid={ariaInvalid || undefined}
            autoComplete={autoComplete}
            className={cn(
              "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
              inputClassName,
              leadingIcon && "pl-9",
              isBusy && "pr-9",
            )}
            disabled={disabled}
            id={id}
            maxLength={maxLength}
            name={name}
            placeholder={placeholder}
            ref={inputRef}
            required={required}
            spellCheck={false}
          />
          {isBusy ? (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
              <LoaderCircleIcon
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            </span>
          ) : null}
        </Autocomplete.InputGroup>

        <Autocomplete.Portal>
          <Autocomplete.Positioner
            align="start"
            className="isolate z-[100]"
            collisionPadding={12}
            positionMethod="fixed"
            sideOffset={4}
          >
            <Autocomplete.Popup
              aria-busy={isBusy || undefined}
              className="flex max-h-[min(22rem,var(--available-height))] w-[var(--anchor-width)] max-w-[calc(100vw-1.5rem)] min-w-64 flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
            >
              {statusMessage ? (
                <div className="shrink-0 border-b border-border px-3 py-2 text-xs leading-5 text-muted-foreground">
                  {statusMessage}
                </div>
              ) : null}

              <Autocomplete.List className="min-h-0 flex-1 overflow-y-auto p-1">
                {suggestions.map((suggestion, index) => (
                  <Autocomplete.Item
                    className="grid cursor-default gap-0.5 rounded-md px-2.5 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                    index={index}
                    key={suggestion.placeId}
                    onClick={() => void selectSuggestion(suggestion)}
                    value={suggestion}
                  >
                    <span className="font-semibold">{suggestion.mainText}</span>
                    {suggestion.secondaryText ? (
                      <span className="text-xs leading-5 text-muted-foreground">
                        {suggestion.secondaryText}
                      </span>
                    ) : null}
                  </Autocomplete.Item>
                ))}
              </Autocomplete.List>

              <div className="shrink-0 border-t border-border px-3 py-1.5 text-right text-[10px] font-semibold tracking-wide text-muted-foreground">
                Address suggestions by{" "}
                <span
                  className="font-[Roboto,Arial,sans-serif] font-normal tracking-normal"
                  translate="no"
                >
                  Google Maps
                </span>
              </div>
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      </Autocomplete.Root>

      <div
        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[11px] leading-4 text-muted-foreground"
        id={disclosureId}
      >
        <span>
          {manualMode || providerDisabled
            ? "Manual entry is on. What you type is not sent to Google Maps."
            : "Address search sends what you type to Google Maps to show suggestions."}
        </span>
        {!providerDisabled ? (
          <button
            className="shrink-0 font-semibold text-foreground underline underline-offset-2 hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={manualMode ? enableAddressSearch : enableManualEntry}
            type="button"
          >
            {manualMode ? "Use address search" : "Enter manually"}
          </button>
        ) : null}
      </div>

      <p
        aria-atomic="true"
        aria-live="polite"
        className="sr-only"
        role="status"
      >
        {announcement}
      </p>

      {error ? (
        <p className="text-xs leading-5 text-muted-foreground" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
