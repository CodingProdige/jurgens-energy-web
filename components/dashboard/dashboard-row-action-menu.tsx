"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MoreVerticalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MenuPosition = {
  left: number;
  top: number;
};

export const dashboardRowActionMenuClass =
  "max-h-[min(22rem,calc(100dvh-8rem))] w-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white text-left text-zinc-950 shadow-2xl [scrollbar-width:thin] dark:border-white/10 dark:bg-[#151719] dark:text-white";

export function DashboardRowActionMenu({
  ariaLabel,
  children,
  className,
  trigger,
  triggerClassName,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  trigger?: ReactNode;
  triggerClassName?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth ?? 256;
    const menuHeight = menuRef.current?.offsetHeight ?? 192;
    const gutter = 8;
    const left = Math.min(
      Math.max(gutter, rect.right - menuWidth),
      window.innerWidth - menuWidth - gutter,
    );
    const belowTop = rect.bottom + gutter;
    const top =
      belowTop + menuHeight > window.innerHeight - gutter
        ? Math.max(gutter, rect.top - menuHeight - gutter)
        : belowTop;

    setPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;

      if (!target) {
        return;
      }

      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon-sm"
        className={cn(
          "text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10",
          triggerClassName,
        )}
        aria-label={ariaLabel}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          event.currentTarget.blur();
          setIsOpen((current) => !current);
        }}
        type="button"
      >
        {trigger ?? <MoreVerticalIcon className="size-4" />}
      </Button>
      {isOpen
        ? createPortal(
            <>
              <button
                aria-label="Close row actions"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setIsOpen(false)}
                type="button"
              />
              <div
                ref={menuRef}
                className={cn("fixed z-50", dashboardRowActionMenuClass, className)}
                style={{
                  left: position?.left ?? -9999,
                  top: position?.top ?? -9999,
                }}
                onClick={(event) => {
                  const target = event.target;

                  if (target instanceof Element && target.closest("form")) {
                    return;
                  }

                  setIsOpen(false);
                }}
                onSubmitCapture={() => {
                  window.setTimeout(() => setIsOpen(false), 0);
                }}
              >
                {children}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
