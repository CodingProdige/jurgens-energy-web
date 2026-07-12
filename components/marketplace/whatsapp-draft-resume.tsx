"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  MessageCircleIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { addLocalCartItem } from "@/src/modules/cart";
import type { WhatsappDraftCartPayload } from "@/src/modules/whatsapp-ordering/service";

type ResumeStatus = "loading" | "ready" | "error";

export function WhatsappDraftResume({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<ResumeStatus>("loading");
  const [message, setMessage] = useState("Preparing your gas order...");

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    async function resumeDraft() {
      try {
        const response = await fetch(
          `/api/whatsapp/drafts/${encodeURIComponent(token)}`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error("This WhatsApp order link has expired.");
        }

        const draft = (await response.json()) as WhatsappDraftCartPayload;

        addLocalCartItem(draft.cartItem);

        const consumeResponse = await fetch(
          `/api/whatsapp/drafts/${encodeURIComponent(token)}`,
          {
          cache: "no-store",
          method: "POST",
          },
        );

        if (!consumeResponse.ok) {
          const payload = (await consumeResponse.json().catch(() => null)) as {
            message?: string;
          } | null;

          throw new Error(
            payload?.message ??
              "This WhatsApp order link could not be linked to your account.",
          );
        }

        if (cancelled) {
          return;
        }

        setStatus("ready");
        setMessage(`${draft.summary.productTitle} is ready for checkout.`);
        timeoutId = window.setTimeout(() => {
          router.replace("/checkout");
        }, 900);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "This WhatsApp order link could not be opened.",
        );
      }
    }

    void resumeDraft();

    return () => {
      cancelled = true;

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [router, token]);

  return (
    <section className="grid min-h-[58dvh] place-items-center px-4 py-12">
      <div className="w-full max-w-md overflow-hidden rounded-md border border-[#e8e8e2] bg-white text-center shadow-[0_18px_50px_rgba(8,8,8,0.08)] dark:border-white/10 dark:bg-[#101010]">
        <div className="border-b border-[#e8e8e2] px-6 py-7 dark:border-white/10">
          <span
            className={cn(
              "mx-auto grid size-14 place-items-center rounded-full",
              status === "error"
                ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
                : "bg-[#ff5a1f]/10 text-[#ff5a1f]",
            )}
          >
            {status === "loading" ? (
              <LoaderCircleIcon className="size-6 animate-spin" />
            ) : status === "ready" ? (
              <CheckCircle2Icon className="size-6" />
            ) : (
              <AlertCircleIcon className="size-6" />
            )}
          </span>
          <h1 className="mt-5 text-2xl font-black leading-tight">
            WhatsApp Order
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
            {message}
          </p>
        </div>

        <div className="grid gap-3 px-6 py-5">
          {status === "ready" ? (
            <Button
              className="h-11 rounded-md bg-[#ff5a1f] text-sm font-bold text-white hover:bg-[#e84c15]"
              onClick={() => router.replace("/checkout")}
              type="button"
            >
              Continue to checkout
            </Button>
          ) : null}
          {status === "error" ? (
            <>
              <Link
                className={cn(
                  buttonVariants(),
                  "h-11 rounded-md bg-[#ff5a1f] text-sm font-bold text-white hover:bg-[#e84c15]",
                )}
                href="/products"
              >
                Shop gas cylinders
              </Link>
              <Link
                className="inline-flex h-10 items-center justify-center gap-2 text-sm font-semibold text-[#55554f] transition hover:text-[#ff5a1f] dark:text-[#c7c7c0]"
                href="/cart"
              >
                <MessageCircleIcon className="size-4" />
                View cart
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
