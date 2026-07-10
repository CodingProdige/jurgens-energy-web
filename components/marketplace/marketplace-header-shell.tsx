"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type MarketplaceHeaderShellProps = {
  children: ReactNode;
};

export function MarketplaceHeaderShell({
  children,
}: MarketplaceHeaderShellProps) {
  const lastScrollYRef = useRef(0);
  const tickingRef = useRef(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    function updateVisibility() {
      const currentScrollY = window.scrollY;
      const lastScrollY = lastScrollYRef.current;
      const isCompactHeader = window.matchMedia("(max-width: 1279px)").matches;

      if (!isCompactHeader || currentScrollY < 96) {
        setIsHidden(false);
      } else if (currentScrollY > lastScrollY + 8) {
        setIsHidden(true);
      } else if (currentScrollY < lastScrollY - 8) {
        setIsHidden(false);
      }

      lastScrollYRef.current = Math.max(currentScrollY, 0);
      tickingRef.current = false;
    }

    function handleScroll() {
      if (tickingRef.current) {
        return;
      }

      tickingRef.current = true;
      window.requestAnimationFrame(updateVisibility);
    }

    lastScrollYRef.current = window.scrollY;
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateVisibility);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateVisibility);
    };
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-[#e8e8e2] bg-white/96 shadow-[0_2px_18px_rgba(8,8,8,0.04)] backdrop-blur transition-transform duration-300 ease-out motion-reduce:transition-none dark:border-white/10 dark:bg-[#080808]/96",
        isHidden && "-translate-y-full xl:translate-y-0",
      )}
    >
      {children}
    </header>
  );
}
