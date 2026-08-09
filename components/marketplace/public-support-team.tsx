import Image from "next/image";
import Link from "next/link";
import {
  Clock3Icon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  UserRoundIcon,
} from "lucide-react";

import { PublicEmailAddress } from "@/components/marketplace/public-email-address";
import { normalizePhoneNumber } from "@/src/modules/phone";
import type { PublicSupportAgent } from "@/src/modules/support-agents/server";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function phoneHref(phoneNumber: string | null) {
  if (!phoneNumber) {
    return null;
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber, {
    defaultCountryCode: "ZA",
  });

  return normalizedPhone ? `tel:${normalizedPhone}` : null;
}

function whatsappHref(phoneNumber: string | null) {
  if (!phoneNumber) {
    return null;
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber, {
    defaultCountryCode: "ZA",
  });
  const phoneDigits = normalizedPhone?.replace(/\D/g, "") ?? "";

  return phoneDigits ? `https://wa.me/${phoneDigits}` : null;
}

function AgentPhoto({
  agent,
  size,
}: {
  agent: PublicSupportAgent;
  size: "compact" | "full";
}) {
  const sizeClass = size === "compact" ? "size-11" : "size-24 sm:size-28";

  return (
    <span
      className={`${sizeClass} relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#ff5a1f] to-[#ffb000] font-black text-white`}
    >
      {agent.photoUrl ? (
        <Image
          alt={`${agent.displayName} profile`}
          className="object-cover"
          fill
          sizes={size === "compact" ? "44px" : "112px"}
          src={agent.photoUrl}
        />
      ) : (
        initials(agent.displayName) || <UserRoundIcon className="size-5" />
      )}
    </span>
  );
}

function AgentContactLinks({ agent }: { agent: PublicSupportAgent }) {
  const callUrl = phoneHref(agent.publicPhone);
  const whatsappUrl = whatsappHref(agent.publicWhatsapp);

  return (
    <div className="mt-5 flex min-w-0 flex-wrap gap-2">
      {agent.publicEmail ? (
        <a
          className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-[#deded7] px-3 py-2 text-[12px] font-bold text-[#30302c] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/15 dark:text-[#e4e4dc]"
          href={`mailto:${agent.publicEmail}`}
        >
          <MailIcon className="size-3.5 shrink-0" />
          <PublicEmailAddress
            className="min-w-0 truncate"
            email={agent.publicEmail}
          />
        </a>
      ) : null}
      {callUrl ? (
        <a
          className="inline-flex items-center gap-2 rounded-full border border-[#deded7] px-3 py-2 text-[12px] font-bold text-[#30302c] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/15 dark:text-[#e4e4dc]"
          href={callUrl}
        >
          <PhoneIcon className="size-3.5" />
          {agent.publicPhone}
        </a>
      ) : null}
      {whatsappUrl ? (
        <a
          className="inline-flex items-center gap-2 rounded-full border border-[#deded7] px-3 py-2 text-[12px] font-bold text-[#30302c] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/15 dark:text-[#e4e4dc]"
          href={whatsappUrl}
          rel="noreferrer"
          target="_blank"
        >
          <MessageCircleIcon className="size-3.5" />
          WhatsApp
        </a>
      ) : null}
    </div>
  );
}

export function PublicSupportAgentCards({
  agents,
}: {
  agents: PublicSupportAgent[];
}) {
  if (agents.length === 0) {
    return null;
  }

  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      {agents.map((agent) => (
        <article
          className="min-w-0 rounded-xl border border-[#deded7] bg-white p-5 dark:border-white/10 dark:bg-[#141414] sm:p-6"
          key={agent.id}
        >
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
            <AgentPhoto agent={agent} size="full" />
            <div className="min-w-0 flex-1">
              <h3 className="break-words text-[18px] font-black leading-tight text-[#080808] dark:text-[#f7f7f2]">
                {agent.displayName}
              </h3>
              {agent.roleTitle ? (
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#ff5a1f]">
                  {agent.roleTitle}
                </p>
              ) : null}
              {agent.bio ? (
                <p className="mt-4 break-words text-[13px] leading-6 text-[#62625c] dark:text-[#bdbdb5]">
                  {agent.bio}
                </p>
              ) : null}
              {agent.availability ? (
                <p className="mt-4 flex items-start gap-2 text-[12px] font-semibold leading-5 text-[#4f4f49] dark:text-[#d1d1ca]">
                  <Clock3Icon className="mt-0.5 size-4 shrink-0 text-[#ff5a1f]" />
                  <span>{agent.availability}</span>
                </p>
              ) : null}
            </div>
          </div>
          <AgentContactLinks agent={agent} />
        </article>
      ))}
    </div>
  );
}

export function PublicSupportAgentFooterList({
  agents,
}: {
  agents: PublicSupportAgent[];
}) {
  if (agents.length === 0) {
    return null;
  }

  return (
    <section className="border-b border-[#ecece6] px-4 py-7 dark:border-white/10 sm:px-0 sm:py-8">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[13px] font-black uppercase">Contact our team</h2>
          <p className="mt-1 text-[12px] leading-5 text-[#696963] dark:text-[#a8a89f]">
            Reach a published Jurgens Energy contact directly.
          </p>
        </div>
        <Link
          className="text-[11px] font-black uppercase tracking-[0.08em] text-[#ff5a1f] transition hover:text-[#e44c15]"
          href="/support"
        >
          View support details →
        </Link>
      </div>

      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {agents.map((agent) => {
          const callUrl = phoneHref(agent.publicPhone);
          const whatsappUrl = whatsappHref(agent.publicWhatsapp);

          return (
            <article
              className="flex min-w-0 items-center gap-3 rounded-lg border border-[#e8e8e2] bg-[#fbfbf8] p-3 dark:border-white/10 dark:bg-white/[0.04]"
              key={agent.id}
            >
              <AgentPhoto agent={agent} size="compact" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black">
                  {agent.displayName}
                </p>
                {agent.roleTitle ? (
                  <p className="mt-0.5 truncate text-[11px] text-[#696963] dark:text-[#aaa9a2]">
                    {agent.roleTitle}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  {agent.publicEmail ? (
                    <a
                      aria-label={`Email ${agent.displayName}`}
                      className="grid size-7 place-items-center rounded-full border border-[#d8d8d0] text-[#4f4f49] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/15 dark:text-[#c8c8c0]"
                      href={`mailto:${agent.publicEmail}`}
                    >
                      <MailIcon className="size-3.5" />
                    </a>
                  ) : null}
                  {callUrl ? (
                    <a
                      aria-label={`Call ${agent.displayName}`}
                      className="grid size-7 place-items-center rounded-full border border-[#d8d8d0] text-[#4f4f49] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/15 dark:text-[#c8c8c0]"
                      href={callUrl}
                    >
                      <PhoneIcon className="size-3.5" />
                    </a>
                  ) : null}
                  {whatsappUrl ? (
                    <a
                      aria-label={`WhatsApp ${agent.displayName}`}
                      className="grid size-7 place-items-center rounded-full border border-[#d8d8d0] text-[#4f4f49] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/15 dark:text-[#c8c8c0]"
                      href={whatsappUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <MessageCircleIcon className="size-3.5" />
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
