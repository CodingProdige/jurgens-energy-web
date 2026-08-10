import "server-only";

import { processCreditNotePipeline } from "@/src/modules/invoices/credit-note-jobs";
import { processInvoicePipeline } from "@/src/modules/invoices/jobs";
import { expirePendingCheckoutOrders } from "@/src/modules/inventory/pending-orders";
import { processNotificationDispatchRetries } from "@/src/modules/notifications/worker";
import { processRefundShipmentCancellationJobs } from "@/src/modules/payments/refund-fulfillment-worker";
import { reconcilePendingPayFastRefunds } from "@/src/modules/payments/refunds";
import { processSaleCampaignLifecycle } from "@/src/modules/sales/lifecycle";

const workerState = globalThis as typeof globalThis & {
  __jurgensInvoiceWorker?: {
    running: boolean;
    timer: NodeJS.Timeout;
  };
  __jurgensSaleLifecycleWorker?: {
    running: boolean;
    timer: NodeJS.Timeout;
  };
};

async function runSaleLifecyclePass(state: { running: boolean }) {
  if (state.running) {
    return;
  }

  state.running = true;

  try {
    const result = await processSaleCampaignLifecycle();

    if (result.activated > 0 || result.ended > 0 || result.failures.length > 0) {
      console.info("[sale-lifecycle-worker] pass completed", result);
    }
  } catch (error: unknown) {
    console.error("[sale-lifecycle-worker] pass failed", error);
  } finally {
    state.running = false;
  }
}

function startSaleLifecycleWorker() {
  if (workerState.__jurgensSaleLifecycleWorker) {
    return;
  }

  const state = {
    running: false,
    timer: setInterval(() => {
      void runSaleLifecyclePass(state);
    }, 7_500),
  };

  state.timer.unref();
  workerState.__jurgensSaleLifecycleWorker = state;

  setTimeout(() => {
    void runSaleLifecyclePass(state);
  }, 1_000).unref();
}

export function startInvoiceWorker() {
  startSaleLifecycleWorker();

  if (workerState.__jurgensInvoiceWorker) {
    return;
  }

  const state = {
    running: false,
    timer: setInterval(() => {
      if (state.running) {
        return;
      }

      state.running = true;
      void Promise.all([
        processInvoicePipeline(),
        processCreditNotePipeline(),
        expirePendingCheckoutOrders(),
        processNotificationDispatchRetries(),
        processRefundShipmentCancellationJobs(),
        reconcilePendingPayFastRefunds(),
      ])
        .catch((error) => {
          console.error("[document-worker] pipeline pass failed", error);
        })
        .finally(() => {
          state.running = false;
        });
    }, 30_000),
  };

  state.timer.unref();
  workerState.__jurgensInvoiceWorker = state;

  setTimeout(() => {
    if (!state.running) {
      state.running = true;
      void Promise.all([
        processInvoicePipeline(),
        processCreditNotePipeline(),
        expirePendingCheckoutOrders(),
        processNotificationDispatchRetries(),
        processRefundShipmentCancellationJobs(),
        reconcilePendingPayFastRefunds(),
      ])
        .catch((error) => {
          console.error("[document-worker] startup pass failed", error);
        })
        .finally(() => {
          state.running = false;
        });
    }
  }, 5_000).unref();
}
