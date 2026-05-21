"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { usePiessangTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const modes = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

type ThemeToggleProps = {
  compact?: boolean;
  className?: string;
};

export function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
  const { theme, setTheme } = usePiessangTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const currentTheme = mounted ? theme ?? "system" : "system";
  const activeMode = modes.find((mode) => mode.value === currentTheme) ?? modes[2];
  const ActiveIcon = activeMode.icon;

  if (compact) {
    return (
      <Button
        aria-label={`Current theme: ${activeMode.label}. Change theme.`}
        size="icon-sm"
        variant="ghost"
        className={cn(
          "rounded-full text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white",
          className,
        )}
        onClick={() => {
          const currentIndex = modes.findIndex((mode) => mode.value === currentTheme);
          const nextMode = modes[(currentIndex + 1) % modes.length] ?? modes[0];

          setTheme(nextMode.value);
        }}
        type="button"
      >
        <ActiveIcon className="size-3.5" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-slate-200 bg-slate-100 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        className,
      )}
    >
      {modes.map(({ value, label, icon: Icon }) => {
        const isActive = currentTheme === value;

        return (
          <Button
            key={value}
            aria-label={`Use ${label.toLowerCase()} theme`}
            aria-pressed={isActive}
            size="icon-sm"
            variant="ghost"
            className={
              isActive
                ? "rounded-full bg-white text-zinc-950 shadow-sm hover:bg-white dark:bg-zinc-100 dark:text-zinc-950"
                : "rounded-full text-zinc-500 hover:bg-white/60 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
            }
            onClick={() => {
              setTheme(value);
            }}
            type="button"
          >
            <Icon className="size-3.5" />
          </Button>
        );
      })}
    </div>
  );
}
