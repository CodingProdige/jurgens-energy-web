import type { Metadata } from "next";

import { PolicyPage } from "@/src/modules/marketplace/policies/policy-page";
import { returnsAndRefundsPolicy } from "@/src/modules/marketplace/policies/documents";

export const metadata: Metadata = {
  title: "Returns & Refunds",
  description:
    "Understand Jurgens Energy cancellations, cooling-off rights, damaged or defective goods, LPG return safety, and refund handling.",
};

export default function ReturnsAndRefundsPage() {
  return <PolicyPage document={returnsAndRefundsPolicy} />;
}
