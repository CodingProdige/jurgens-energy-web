import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, FileTextIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PublicBlogPostSummary } from "@/src/modules/blog";

export function MarketplaceBlogCard({
  className,
  post,
}: {
  className?: string;
  post: PublicBlogPostSummary;
}) {
  return (
    <article
      className={cn(
        "group overflow-hidden rounded-md border border-[#e8e8e2] bg-white text-[#080808] shadow-[0_4px_14px_rgba(8,8,8,0.04)] transition hover:-translate-y-0.5 hover:border-[#ff5a1f]/55 hover:shadow-[0_12px_28px_rgba(8,8,8,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#f7f7f2] dark:shadow-none",
        className,
      )}
    >
      <Link className="block" href={`/blog/${post.slug}`}>
        <div className="relative aspect-[4/3] bg-[#f7f7f2] dark:bg-[#1a1a1a]">
          {post.coverImageUrl ? (
            <Image
              alt={post.title}
              className="object-cover transition duration-300 group-hover:scale-[1.03]"
              fill
              sizes="(min-width: 1024px) 360px, 90vw"
              src={post.coverImageUrl}
            />
          ) : (
            <div className="grid size-full place-items-center text-[#ff5a1f]">
              <FileTextIcon className="size-10 stroke-[1.4]" />
            </div>
          )}
        </div>
        <div className="grid gap-2 p-3 sm:p-4">
          <p className="text-[11px] font-normal uppercase tracking-[0.18em] text-[#ff5a1f]">
            {formatBlogDate(post.publishedAt)}
          </p>
          <h3 className="line-clamp-2 text-[18px] font-black leading-tight sm:text-[20px]">
            {post.title}
          </h3>
          {post.excerpt ? (
            <p className="line-clamp-3 text-[13px] leading-5 text-[#4f4f49] dark:text-[#c8c8c0]">
              {post.excerpt}
            </p>
          ) : null}
          <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-normal uppercase text-[#080808] transition group-hover:text-[#ff5a1f] dark:text-[#f7f7f2]">
            Read more
            <ArrowRightIcon className="size-3.5" />
          </span>
        </div>
      </Link>
    </article>
  );
}

export function formatBlogDate(date: Date | null) {
  if (!date) {
    return "Latest";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
