"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  RetryPayFastPaymentError,
  retryHostedPayFastPayment,
} from "@/src/modules/checkout/retry-payment";
import { requireCustomerAccount } from "@/src/modules/marketplace/account/data";

export type RetryPaymentActionState = {
  error: string | null;
};

const orderIdSchema = z.string().uuid();

export async function retryPayFastPaymentAction(
  orderId: string,
  previousState: RetryPaymentActionState,
  formData: FormData,
): Promise<RetryPaymentActionState> {
  void previousState;
  void formData;

  const parsedOrderId = orderIdSchema.safeParse(orderId);

  if (!parsedOrderId.success) {
    return { error: "This order could not be found." };
  }

  const account = await requireCustomerAccount();
  let redirectUrl: string;

  try {
    const result = await retryHostedPayFastPayment({
      orderId: parsedOrderId.data,
      userId: account.id,
    });

    redirectUrl = result.redirectUrl;
  } catch (error) {
    if (error instanceof RetryPayFastPaymentError) {
      return { error: error.message };
    }

    console.error("Retrying PayFast checkout failed", error);

    return {
      error: "Payment could not be reopened. Please try again in a moment.",
    };
  }

  redirect(redirectUrl);
}
