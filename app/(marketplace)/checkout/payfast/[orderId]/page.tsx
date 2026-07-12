import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PayFastRedirectForm } from "@/components/marketplace/payfast-redirect-form";
import { getHostedPayFastForm } from "@/src/modules/checkout/payfast";

export const metadata: Metadata = {
  title: "Secure Payment",
  description: "Continue to PayFast to complete your Jurgens Energy order.",
  robots: { follow: false, index: false },
};

export default async function PayFastRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const [{ orderId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const token = Array.isArray(resolvedSearchParams.token)
    ? resolvedSearchParams.token[0]
    : resolvedSearchParams.token;

  if (!token) {
    notFound();
  }

  const paymentForm = await getHostedPayFastForm(orderId, token);

  if (!paymentForm) {
    notFound();
  }

  return <PayFastRedirectForm {...paymentForm} />;
}
