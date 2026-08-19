"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type PointerEvent } from "react";

type ProductCardImageScrubberProps = {
  alt: string;
  analytics: {
    brandName: string | null;
    categoryName: string | null;
    productId: string;
    productName: string;
  };
  href: string;
  imageUrls: string[];
};

export function ProductCardImageScrubber({
  alt,
  analytics,
  href,
  imageUrls,
}: ProductCardImageScrubberProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultipleImages = imageUrls.length > 1;
  const activeImageUrl = imageUrls[activeIndex] ?? imageUrls[0];

  function updateActiveImage(event: PointerEvent<HTMLAnchorElement>) {
    if (event.pointerType !== "mouse" || !hasMultipleImages) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const horizontalPosition = Math.max(
      0,
      Math.min(bounds.width, event.clientX - bounds.left),
    );
    const nextIndex = Math.min(
      imageUrls.length - 1,
      Math.floor((horizontalPosition / bounds.width) * imageUrls.length),
    );

    setActiveIndex(nextIndex);
  }

  if (!activeImageUrl) {
    return null;
  }

  return (
    <Link
      aria-hidden="true"
      className="group/product-card-scrubber absolute inset-0 pointer-events-auto"
      data-analytics-event="select_item"
      data-analytics-item-brand={analytics.brandName ?? undefined}
      data-analytics-item-category={analytics.categoryName ?? undefined}
      data-analytics-item-id={analytics.productId}
      data-analytics-item-name={analytics.productName}
      href={href}
      onPointerEnter={updateActiveImage}
      onPointerLeave={() => setActiveIndex(0)}
      onPointerMove={updateActiveImage}
      prefetch={false}
      tabIndex={-1}
    >
      <Image
        alt={alt}
        className="marketplace-product-card-media object-cover"
        fill
        loading="eager"
        quality={90}
        sizes="(min-width: 1280px) 220px, (min-width: 768px) 25vw, 50vw"
        src={activeImageUrl}
      />
      {hasMultipleImages ? (
        <span className="pointer-events-none absolute inset-x-2 bottom-1.5 flex gap-0.5 opacity-0 transition-opacity group-hover/product-card-scrubber:opacity-100 sm:bottom-2">
          {imageUrls.map((imageUrl, index) => (
            <span
              className={
                index === activeIndex
                  ? "h-0.5 flex-1 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
                  : "h-0.5 flex-1 rounded-full bg-white/45"
              }
              key={imageUrl}
            />
          ))}
        </span>
      ) : null}
    </Link>
  );
}
