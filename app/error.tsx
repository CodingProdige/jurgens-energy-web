"use client";

import Link from "next/link";
import { HouseIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";

import { BrandedSystemState } from "@/components/brand/branded-system-state";
import {
  marketplacePrimaryActionClass,
  marketplaceSecondaryActionClass,
} from "@/components/marketplace/action-styles";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <title>Something went wrong | Jurgens Energy</title>
      <BrandedSystemState
        actions={
          <>
            <button
              className={`${marketplacePrimaryActionClass} gap-2`}
              onClick={() => unstable_retry()}
              type="button"
            >
              <RotateCcwIcon className="size-4" />
              Try again
            </button>
            <Link
              className={`${marketplaceSecondaryActionClass} gap-2`}
              href="/"
            >
              <HouseIcon className="size-4" />
              Return home
            </Link>
          </>
        }
        code={error.digest ? `Reference ${error.digest}` : "Error"}
        description="Something interrupted this page before it could finish loading. Try the request again, or return home and continue shopping."
        eyebrow="Unexpected problem"
        icon={TriangleAlertIcon}
        title="Something went wrong."
      />
    </>
  );
}
