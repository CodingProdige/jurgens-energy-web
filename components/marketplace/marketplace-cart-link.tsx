"use client";

import Link from "next/link";
import { ShoppingCartIcon } from "lucide-react";
import { useEffect, useState } from "react";

import {
  getLocalCartState,
  subscribeToLocalCart,
} from "@/src/modules/cart";

export function MarketplaceCartLink() {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    setCartCount(getLocalCartState().count);

    return subscribeToLocalCart((state) => setCartCount(state.count));
  }, []);

  return (
    <Link
      aria-label={`Cart${cartCount > 0 ? ` with ${cartCount} item${cartCount === 1 ? "" : "s"}` : ""}`}
      className="relative grid size-9 place-items-center text-[#080808] dark:text-[#f7f7f2] sm:size-12"
      href="/cart"
    >
      <ShoppingCartIcon className="size-5 stroke-[1.8] sm:size-7" />
      <span className="absolute right-0 top-0 grid size-4 place-items-center rounded-full bg-[#ff5a1f] text-[9px] font-black text-white shadow-sm sm:right-1 sm:size-5 sm:text-[10px]">
        {cartCount > 99 ? "99+" : cartCount}
      </span>
    </Link>
  );
}
