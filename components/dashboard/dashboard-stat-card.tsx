import type { ComponentType } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DashboardStatCardProps = {
  label: string;
  value: string | number;
  description: string;
  icon: ComponentType<{ className?: string }>;
  accent?: "amber" | "green";
};

const accentStyles = {
  amber: {
    shadow: "shadow-amber-950/10",
    icon: "bg-amber-600/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  },
  green: {
    shadow: "shadow-emerald-950/10",
    icon: "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
} as const;

export function DashboardStatCard({
  label,
  value,
  description,
  icon: Icon,
  accent = "amber",
}: DashboardStatCardProps) {
  const styles = accentStyles[accent];

  return (
    <Card
      className={cn(
        "rounded-2xl border-white/70 bg-white/76 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#171718]/88 dark:shadow-black/30",
        styles.shadow,
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardDescription>{label}</CardDescription>
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-lg",
              styles.icon,
            )}
          >
            <Icon className="size-4" />
          </div>
        </div>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
