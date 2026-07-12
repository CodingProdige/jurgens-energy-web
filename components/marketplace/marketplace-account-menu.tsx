"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  LayoutDashboardIcon,
  LogOutIcon,
  MessageCircleIcon,
  ShoppingCartIcon,
  UserIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type MarketplaceAccountSummary = {
  email: string | null | undefined;
  image: string | null | undefined;
  name: string | null | undefined;
  roles: string[];
};

type MarketplaceAccountMenuProps = {
  className?: string;
  user: MarketplaceAccountSummary | null;
};

export function MarketplaceAccountMenu({
  className,
  user,
}: MarketplaceAccountMenuProps) {
  if (!user) {
    return (
      <Link
        aria-label="Sign in"
        className={cn(
          "grid size-8 place-items-center rounded-full border border-[#e8e8e2] bg-white/80 text-[#080808] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#f7f7f2] sm:size-9",
          className,
        )}
        href="/sign-in"
      >
        <UserIcon className="size-4" />
      </Link>
    );
  }

  const displayName = user.name || user.email || "Account";
  const initials = getInitials(user);
  const isAdmin = user.roles.includes("admin");
  const isSeller = user.roles.includes("seller");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            aria-label="Open account menu"
            className={cn(
              "grid size-8 place-items-center overflow-hidden rounded-full border border-[#e8e8e2] bg-white/80 text-[#080808] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/40 data-[popup-open]:border-[#ff5a1f] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#f7f7f2] sm:size-9",
              className,
            )}
            type="button"
          >
            {user.image ? (
              <Image
                alt=""
                className="size-full object-cover"
                height={36}
                src={user.image}
                unoptimized
                width={36}
              />
            ) : (
              <span className="text-[11px] font-black uppercase">
                {initials}
              </span>
            )}
          </button>
        }
      />
      <DropdownMenuContent
        align="end"
        className="w-72 border border-[#e8e8e2] bg-white p-2 text-[#080808] shadow-2xl shadow-black/15 dark:border-white/10 dark:bg-[#101010] dark:text-[#f7f7f2]"
        collisionAvoidance={{
          align: "shift",
          fallbackAxisSide: "none",
          side: "flip",
        }}
        collisionPadding={12}
        sideOffset={10}
        sticky
      >
        <div className="flex min-w-0 items-center gap-3 rounded-md bg-[#f7f7f2] p-3 dark:bg-white/[0.06]">
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#ff5a1f] text-sm font-black uppercase text-white">
            {user.image ? (
              <Image
                alt=""
                className="size-full object-cover"
                height={40}
                src={user.image}
                unoptimized
                width={40}
              />
            ) : (
              initials
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{displayName}</p>
            {user.email ? (
              <p className="truncate text-xs text-[#696963] dark:text-[#c8c8c0]">
                {user.email}
              </p>
            ) : null}
          </div>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2 px-3 py-2"
          render={
            <Link href="/cart">
              <ShoppingCartIcon className="size-4" />
              Cart and checkout
            </Link>
          }
        />
        <DropdownMenuItem
          className="cursor-pointer gap-2 px-3 py-2"
          render={
            <Link href="/account/whatsapp">
              <MessageCircleIcon className="size-4" />
              WhatsApp number
            </Link>
          }
        />
        {isAdmin ? (
          <DropdownMenuItem
            className="cursor-pointer gap-2 px-3 py-2"
            render={
              <Link href="/admin">
                <LayoutDashboardIcon className="size-4" />
                Admin dashboard
              </Link>
            }
          />
        ) : null}
        {isSeller ? (
          <DropdownMenuItem
            className="cursor-pointer gap-2 px-3 py-2"
            render={
              <Link href="/seller">
                <LayoutDashboardIcon className="size-4" />
                Seller dashboard
              </Link>
            }
          />
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2 px-3 py-2 text-[#b42318] focus:bg-[#fff2ef] focus:text-[#b42318] dark:text-[#ffb19a] dark:focus:bg-[#ff5a1f]/10 dark:focus:text-[#ffb19a]"
          onClick={() => {
            void signOut({ callbackUrl: "/" });
          }}
        >
          <LogOutIcon className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function getInitials(user: MarketplaceAccountSummary) {
  const source = user.name || user.email || "JE";
  const parts = source
    .split(/[\s@._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (parts[0]?.[0] ?? "J").concat(parts[1]?.[0] ?? "E").toUpperCase();
}
