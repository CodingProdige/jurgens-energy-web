import type { Metadata } from "next";

import { MarketplaceBlogCard } from "@/components/marketplace/blog-card";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { getPublishedBlogPosts } from "@/src/modules/blog";
import { getStaticPageMetadata } from "@/src/modules/marketplace/static-page-seo";

export async function generateMetadata(): Promise<Metadata> {
  return getStaticPageMetadata("blog");
}

export const dynamic = "force-dynamic";

export default async function BlogIndexPage() {
  const posts = await getPublishedBlogPosts();

  return (
    <MarketplaceGate>
      <div className="min-h-screen bg-[#f7f7f2] text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2]">
        <MarketplaceHeader />
        <main className="w-full bg-white dark:bg-[#101010] sm:mx-auto sm:w-[min(1500px,calc(100%-1rem))] sm:border-x sm:border-b sm:border-[#e8e8e2] sm:shadow-[0_18px_60px_rgba(8,8,8,0.06)] sm:dark:border-white/10">
          <section className="border-b border-[#ecece6] px-4 py-8 dark:border-white/10 sm:px-10 sm:py-12 lg:px-16">
            <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#ff5a1f]">
              Blog
            </p>
            <h1 className="mt-3 max-w-3xl text-[36px] font-black uppercase leading-tight tracking-normal sm:text-[52px]">
              LPG advice, safety notes, and delivery updates.
            </h1>
            <p className="mt-4 max-w-xl text-[16px] font-semibold leading-7 text-[#4f4f49] dark:text-[#c8c8c0]">
              Practical guides from Jurgens Energy for homes and businesses
              using LPG every day.
            </p>
          </section>

          <section className="px-1.5 py-4 sm:px-10 sm:py-8 lg:px-16">
            {posts.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                {posts.map((post) => (
                  <MarketplaceBlogCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="grid min-h-[260px] place-items-center rounded-lg border border-dashed border-[#e8e8e2] bg-white p-6 text-center text-sm font-semibold text-[#4f4f49] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#c8c8c0]">
                Blog posts will appear here once published.
              </div>
            )}
          </section>
        </main>
        <MarketplaceFooter />
      </div>
    </MarketplaceGate>
  );
}
