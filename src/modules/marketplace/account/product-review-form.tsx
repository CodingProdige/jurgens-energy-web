"use client";

import { useActionState, useMemo, useState } from "react";
import { StarIcon } from "lucide-react";

import {
  submitOrderItemProductReviewAction,
  type SubmitProductReviewActionState,
} from "@/app/(marketplace)/account/orders/[orderId]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CustomerOrderDetail } from "@/src/modules/marketplace/account/data";

const initialState: SubmitProductReviewActionState = {
  message: null,
  ok: false,
};

function getReviewStatusLabel(status: string) {
  if (status === "approved") {
    return "Approved and live";
  }

  if (status === "rejected") {
    return "Changes requested";
  }

  if (status === "hidden") {
    return "Hidden by moderation";
  }

  return "Waiting for approval";
}

function ReadOnlyStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[#ff5a1f]">
      {Array.from({ length: 5 }, (_, index) => (
        <StarIcon
          aria-hidden="true"
          className={cn(
            "size-3.5",
            index < rating ? "fill-current" : "text-slate-300",
          )}
          key={index}
        />
      ))}
    </span>
  );
}

export function ProductReviewForm({
  item,
  orderId,
}: {
  item: CustomerOrderDetail["items"][number];
  orderId: string;
}) {
  const [rating, setRating] = useState(item.review?.rating ?? 5);
  const action = useMemo(
    () => submitOrderItemProductReviewAction.bind(null, orderId),
    [orderId],
  );
  const [state, formAction, pending] = useActionState(action, initialState);
  const canSubmitReview =
    item.canReview && (!item.review || item.review.status === "rejected");

  if (!item.canReview && !item.review) {
    return null;
  }

  return (
    <div
      className="mt-3 rounded-md border border-[#f0d7ca] bg-[#fff8f5] p-3 dark:border-[#ff5a1f]/25 dark:bg-[#ff5a1f]/8"
      id={`review-${item.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-[#d9460f] dark:text-[#ff8a60]">
            Product review
          </p>
          <p className="mt-1 text-xs leading-5 text-[#666660] dark:text-[#aaa9a1]">
            Verified-purchase reviews help other customers choose confidently.
          </p>
        </div>
        {item.review ? (
          <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-white px-2 text-[11px] font-black text-[#d9460f] ring-1 ring-[#ff5a1f]/20 dark:bg-white/10 dark:text-[#ffb08e]">
            {getReviewStatusLabel(item.review.status)}
          </span>
        ) : null}
      </div>

      {item.review && item.review.status !== "rejected" ? (
        <div className="mt-3 grid gap-1.5 rounded-md bg-white p-3 text-xs dark:bg-white/[0.06]">
          <ReadOnlyStars rating={item.review.rating} />
          {item.review.title ? (
            <p className="font-black text-[#080808] dark:text-[#f7f7f2]">
              {item.review.title}
            </p>
          ) : null}
          {item.review.body ? (
            <p className="leading-5 text-[#666660] dark:text-[#aaa9a1]">
              {item.review.body}
            </p>
          ) : null}
        </div>
      ) : null}

      {item.review?.status === "rejected" && item.review.rejectedReason ? (
        <p className="mt-3 rounded-md bg-white px-3 py-2 text-xs leading-5 text-[#7a3a22] ring-1 ring-[#ff5a1f]/15 dark:bg-white/[0.06] dark:text-[#ffc4ad]">
          {item.review.rejectedReason}
        </p>
      ) : null}

      {canSubmitReview ? (
        <form action={formAction} className="mt-3 grid gap-3">
          <input name="orderItemId" type="hidden" value={item.id} />
          <input name="rating" type="hidden" value={rating} />

          <div className="grid gap-1.5">
            <span className="text-xs font-black text-[#080808] dark:text-[#f7f7f2]">
              Your rating
            </span>
            <div className="flex items-center gap-1" role="radiogroup">
              {Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;
                const selected = value <= rating;

                return (
                  <button
                    aria-checked={rating === value}
                    aria-label={`${value} star${value === 1 ? "" : "s"}`}
                    className={cn(
                      "rounded-sm p-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/40",
                      selected ? "text-[#ff5a1f]" : "text-slate-300",
                    )}
                    key={value}
                    onClick={() => setRating(value)}
                    role="radio"
                    type="button"
                  >
                    <StarIcon
                      aria-hidden="true"
                      className={cn("size-5", selected && "fill-current")}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            className="h-10 rounded-md border-[#e8e8e2] bg-white text-sm dark:border-white/10 dark:bg-white/[0.06]"
            defaultValue={item.review?.title ?? ""}
            maxLength={140}
            name="title"
            placeholder="Short review title (optional)"
          />
          <Textarea
            className="min-h-24 rounded-md border-[#e8e8e2] bg-white text-sm dark:border-white/10 dark:bg-white/[0.06]"
            defaultValue={item.review?.body ?? ""}
            maxLength={2000}
            name="body"
            placeholder="What should other customers know? (optional)"
          />

          {state.message ? (
            <p
              className={cn(
                "rounded-md px-3 py-2 text-xs font-semibold",
                state.ok
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-500/10 text-red-700 dark:text-red-300",
              )}
            >
              {state.message}
            </p>
          ) : null}

          <Button
            className="h-10 w-fit rounded-md bg-[#ff5a1f] px-4 text-sm font-black text-white hover:bg-[#e84c15]"
            disabled={pending}
            type="submit"
          >
            {pending ? "Submitting..." : "Submit review"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
