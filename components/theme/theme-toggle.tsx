"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { persistSharedTheme } from "@/components/theme/theme-sync";

const modes = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const currentTheme = mounted ? theme ?? "system" : "system";

  return (
    <div className="inline-flex rounded-full border border-white/10 bg-black/10 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur dark:bg-white/5">
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
              persistSharedTheme(value);
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
