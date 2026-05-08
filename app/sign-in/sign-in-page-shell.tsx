import type { ReactNode } from "react";

import type { SignInState } from "@/app/sign-in/actions";
import { SignInForm } from "@/app/sign-in/sign-in-form";
import { PiessangLogo } from "@/components/brand/piessang-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SignInPageShellProps = {
  action: (state: SignInState, formData: FormData) => Promise<SignInState>;
  badge: string;
  children?: ReactNode;
  description: string;
  emailPlaceholder?: string;
  eyebrow: string;
  title: string;
};

export function SignInPageShell({
  action,
  badge,
  children,
  description,
  emailPlaceholder,
  eyebrow,
  title,
}: SignInPageShellProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-100 p-4 text-foreground dark:bg-[linear-gradient(180deg,#111112,#171718_42%,#111112)]">
      <section className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <PiessangLogo
              priority
              className="h-[38px] w-[206px]"
              imageClassName="dark:brightness-110"
            />
            <p className="mt-1 text-xs text-muted-foreground">{badge}</p>
          </div>
          <ThemeToggle />
        </div>

        <Card className="border-border/80 bg-card/90 shadow-2xl shadow-zinc-950/10 backdrop-blur-xl dark:shadow-black/30">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {eyebrow}
            </p>
            <CardTitle className="text-3xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm
              action={action}
              emailPlaceholder={emailPlaceholder}
            />
            {children}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
