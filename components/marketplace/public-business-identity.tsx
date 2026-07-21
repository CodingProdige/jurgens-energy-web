import { Building2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PublicBusinessIdentity } from "@/src/modules/business-information";
import { formatRegisteredBusinessAddress } from "@/src/modules/business-information/address-formatting";

export function formatRegisteredAddress(identity: PublicBusinessIdentity) {
  return formatRegisteredBusinessAddress(identity.registeredAddress);
}

function getIdentityLines(
  identity: PublicBusinessIdentity,
  showRegisteredAddress: boolean,
) {
  const registeredAddress = showRegisteredAddress
    ? formatRegisteredAddress(identity)
    : null;

  return [
    `Trading name: ${identity.tradingName}`,
    identity.legalName ? `Legal name: ${identity.legalName}` : null,
    identity.companyRegistrationNumber
      ? `Company registration: ${identity.companyRegistrationNumber}`
      : null,
    identity.vatRegistrationNumber
      ? `VAT registration: ${identity.vatRegistrationNumber}`
      : null,
    registeredAddress
      ? `Registered address for legal notices only (not a shop or returns counter): ${registeredAddress}`
      : null,
  ].filter((line): line is string => Boolean(line));
}

export function PublicBusinessIdentityDisclosure({
  appearance = "panel",
  className,
  identity,
  showRegisteredAddress = false,
  title = "Registered business",
}: {
  appearance?: "footer" | "panel";
  className?: string;
  identity: PublicBusinessIdentity;
  showRegisteredAddress?: boolean;
  title?: string;
}) {
  const lines = getIdentityLines(identity, showRegisteredAddress);

  if (lines.length === 0) {
    return null;
  }

  if (appearance === "footer") {
    return (
      <section
        aria-label="Registered business information"
        className={cn(
          "flex min-w-0 flex-col gap-1.5 border-b border-[#ecece6] px-4 py-4 text-[11px] leading-5 text-[#696963] dark:border-white/10 dark:text-[#a8a89f] sm:px-0",
          className,
        )}
      >
        {lines.map((line) => (
          <p className="break-words" key={line}>
            {line}
          </p>
        ))}
      </section>
    );
  }

  return (
    <aside
      aria-label="Registered business information"
      className={cn(
        "grid min-w-0 gap-4 rounded-lg border border-[#e2e2db] bg-[#fbfbf8] p-5 dark:border-white/10 dark:bg-white/[0.04] sm:grid-cols-[48px_minmax(0,1fr)] sm:p-6",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-lg bg-[#fff0e9] text-[#ff5a1f] dark:bg-[#ff5a1f]/10">
        <Building2Icon className="size-6" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ff5a1f]">
          Legal identity
        </p>
        <h2 className="mt-1.5 text-[18px] font-black leading-tight text-[#080808] dark:text-[#f7f7f2] sm:text-[21px]">
          {title}
        </h2>
        <div className="mt-3 grid gap-1.5 text-[13px] leading-6 text-[#5f5f59] dark:text-[#c1c1b9] sm:text-[14px]">
          {lines.map((line) => (
            <p className="break-words" key={line}>
              {line}
            </p>
          ))}
        </div>
      </div>
    </aside>
  );
}
