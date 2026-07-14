import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PlatformSocialLinks = {
  facebookUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
  whatsappUrl?: string | null;
};

type PlatformSocialLinksProps = {
  className?: string;
  iconClassName?: string;
  links: PlatformSocialLinks;
};

export function PlatformSocialLinks({
  className,
  iconClassName,
  links,
}: PlatformSocialLinksProps) {
  if (
    !links.facebookUrl &&
    !links.instagramUrl &&
    !links.twitterUrl &&
    !links.whatsappUrl
  ) {
    return null;
  }

  return (
    <div className={cn("flex justify-center gap-7", className)}>
      {links.facebookUrl ? (
        <SocialLink
          className={iconClassName}
          href={links.facebookUrl}
          label="Facebook"
        >
          <FacebookMark />
        </SocialLink>
      ) : null}
      {links.instagramUrl ? (
        <SocialLink
          className={iconClassName}
          href={links.instagramUrl}
          label="Instagram"
        >
          <InstagramMark />
        </SocialLink>
      ) : null}
      {links.twitterUrl ? (
        <SocialLink
          className={iconClassName}
          href={links.twitterUrl}
          label="X / Twitter"
        >
          <TwitterMark />
        </SocialLink>
      ) : null}
      {links.whatsappUrl ? (
        <SocialLink
          className={iconClassName}
          href={links.whatsappUrl}
          label="WhatsApp"
        >
          <WhatsappMark />
        </SocialLink>
      ) : null}
    </div>
  );
}

function SocialLink({
  children,
  className,
  href,
  label,
}: {
  children: ReactNode;
  className?: string;
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      rel="noreferrer"
      target="_blank"
      className={cn(
        "grid size-7 place-items-center rounded-full transition hover:bg-[#f1f1ed] hover:text-primary dark:hover:bg-white/10",
        className,
      )}
    >
      {children}
    </a>
  );
}

export function FacebookMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4"
      fill="currentColor"
    >
      <path d="M14 8.4h2.6V5h-3.1C10 5 8.9 7.2 8.9 9.5v1.8H6.4v3.5h2.5V21h3.8v-6.2h3l.5-3.5h-3.5V9.8c0-.9.3-1.4 1.3-1.4Z" />
    </svg>
  );
}

export function InstagramMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17" cy="7" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TwitterMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="currentColor"
    >
      <path d="M13.8 10.5 20.3 3h-1.6l-5.6 6.5L8.6 3H3.4l6.8 9.8L3.4 21h1.6l5.9-7 4.8 7h5.2l-7.1-10.5Zm-2.1 2.4-.7-1L5.6 4.2h2.2l4.4 6.3.7 1 5.8 8.3h-2.2l-4.8-6.9Z" />
    </svg>
  );
}

export function WhatsappMark() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.7 26.2 7.2 21a11.1 11.1 0 1 1 4.7 4.3l-6.2.9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.25"
      />
      <path
        d="M11.3 10.4c.2-.4.4-.6.8-.6h.7c.2 0 .4.1.5.4l.8 1.9c.1.3.1.5-.1.8l-.6.6c-.2.2-.2.5-.1.8.5.9 1.2 1.7 2.1 2.4.8.6 1.5 1 2.3 1.2.3.1.6 0 .8-.2l.8-.8c.2-.2.5-.3.8-.2l1.9.8c.3.1.4.3.4.7 0 .7-.2 1.4-.7 1.9-.5.5-1.2.8-2 .8-1.1 0-3.6-.7-5.9-2.8-2.5-2.3-3.8-5-3.8-6.2 0-.5.1-1 .3-1.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.85"
      />
    </svg>
  );
}
