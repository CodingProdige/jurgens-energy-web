import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DashboardPanelProps = {
  title: string;
  description: string;
  children: ReactNode;
  accent?: "amber" | "green";
};

const accentShadow = {
  amber: "shadow-amber-950/10",
  green: "shadow-emerald-950/10",
} as const;

export function DashboardPanel({
  title,
  description,
  children,
  accent = "amber",
}: DashboardPanelProps) {
  return (
    <Card
      className={cn(
        "rounded-2xl border-white/70 bg-white/76 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#171718]/88 dark:shadow-black/30",
        accentShadow[accent],
      )}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
