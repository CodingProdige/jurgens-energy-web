import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";

import {
  formatBlogDate,
  MarketplaceBlogCard,
} from "@/components/marketplace/blog-card";
import { MarketplaceBlogContent } from "@/components/marketplace/blog-content";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import {
  estimateBlogReadingMinutes,
  getPublishedBlogPostBySlug,
  getPublishedBlogPosts,
} from "@/src/modules/blog";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Blog Post",
      description: "Read Jurgens Energy blog posts.",
    };
  }

  return {
    title: post.seoTitle ?? post.title,
    description:
      post.seoDescription ??
      post.excerpt ??
      "Read Jurgens Energy LPG advice, safety notes, and delivery updates.",
    openGraph: {
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
      title: post.seoTitle ?? post.title,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = (await getPublishedBlogPosts(4)).filter(
    (item) => item.id !== post.id,
  );

  return (
    <MarketplaceGate>
      <div className="min-h-screen bg-[#f7f7f2] text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2]">
        <MarketplaceHeader />
        <main className="w-full overflow-hidden bg-white dark:bg-[#101010] sm:mx-auto sm:w-[min(1500px,calc(100%-1rem))] sm:border-x sm:border-b sm:border-[#e8e8e2] sm:shadow-[0_18px_60px_rgba(8,8,8,0.06)] sm:dark:border-white/10">
          <article className="mx-auto w-full max-w-[1120px] px-4 py-7 sm:px-6 sm:py-11 lg:px-10">
            <header className="mx-auto max-w-3xl">
              <Link
                className="inline-flex items-center gap-2 text-[12px] font-normal uppercase text-[#4f4f49] transition hover:text-[#ff5a1f] dark:text-[#c8c8c0]"
                href="/blog"
              >
                <ArrowLeftIcon className="size-3.5" />
                Blog
              </Link>
              <p className="mt-5 text-[12px] font-black uppercase tracking-[0.2em] text-[#ff5a1f]">
                {formatBlogDate(post.publishedAt)} ·{" "}
                {estimateBlogReadingMinutes(post.content)} min read
              </p>
              <h1 className="mt-3 text-[34px] font-black uppercase leading-[0.98] tracking-normal sm:text-[48px] lg:text-[56px]">
                {post.title}
              </h1>
              {post.excerpt ? (
                <p className="mt-5 text-[16px] font-semibold leading-8 text-[#4f4f49] dark:text-[#c8c8c0] sm:text-[17px]">
                  {post.excerpt}
                </p>
              ) : null}
            </header>

            {post.coverImageUrl ? (
              <figure className="mx-auto mt-8 overflow-hidden border-y border-[#ecece6] bg-[#f7f7f2] dark:border-white/10 dark:bg-[#1a1a1a] sm:mt-10 sm:rounded-lg sm:border">
                <div className="relative aspect-[16/9] w-full">
                  <Image
                    alt={post.title}
                    className="object-contain"
                    fill
                    priority
                    sizes="(min-width: 1280px) 1040px, (min-width: 640px) calc(100vw - 5rem), calc(100vw - 2rem)"
                    src={post.coverImageUrl}
                  />
                </div>
              </figure>
            ) : null}

            <div className="mx-auto max-w-3xl py-8 sm:py-12">
              <MarketplaceBlogContent content={post.content} />
            </div>
          </article>

          {relatedPosts.length > 0 ? (
            <section className="border-t border-[#ecece6] px-4 py-6 dark:border-white/10 sm:px-6 sm:py-10 lg:px-10">
              <div className="mx-auto w-full max-w-[1120px]">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <h2 className="text-[24px] font-black uppercase leading-tight">
                    Latest Posts
                  </h2>
                  <Link
                    className="inline-flex items-center gap-1.5 text-[12px] font-normal uppercase text-[#080808] transition hover:text-[#ff5a1f] dark:text-[#f7f7f2]"
                    href="/blog"
                  >
                    View all
                  </Link>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                  {relatedPosts.slice(0, 3).map((item) => (
                    <MarketplaceBlogCard key={item.id} post={item} />
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </main>
        <MarketplaceFooter />
      </div>
    </MarketplaceGate>
  );
}
