import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PlatformSocialLinks = {
  facebookUrl: string | null;
  instagramUrl: string | null;
  twitterUrl: string | null;
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
  if (!links.facebookUrl && !links.instagramUrl && !links.twitterUrl) {
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
          <span className="text-xl font-bold leading-none">f</span>
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
        "grid size-7 place-items-center rounded-full transition hover:bg-[#f1f1ed] hover:text-[#cca137] dark:hover:bg-white/10",
        className,
      )}
    >
      {children}
    </a>
  );
}

function InstagramMark() {
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

function TwitterMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="currentColor"
    >
      <path d="M20.7 6.2c.1 4.9-3.4 10.4-10.4 10.4-2.1 0-4-.6-5.7-1.7 1.9.2 3.8-.3 5.3-1.5-1.6 0-2.9-1.1-3.4-2.5.6.1 1.1.1 1.6-.1-1.7-.4-2.9-1.8-2.9-3.6.5.3 1 .4 1.6.4C5.2 7 4.9 5 5.8 3.6c1.8 2.2 4.5 3.6 7.5 3.8-.5-2.2 1.2-4.3 3.5-4.3 1 0 2 .4 2.6 1.1.8-.2 1.6-.5 2.3-.9-.3.9-.9 1.6-1.6 2 .7-.1 1.3-.3 1.9-.5-.3.5-.8 1-1.3 1.4Z" />
    </svg>
  );
}
