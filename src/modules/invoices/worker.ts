import "server-only";

import { processCreditNotePipeline } from "@/src/modules/invoices/credit-note-jobs";
import { processInvoicePipeline } from "@/src/modules/invoices/jobs";
import { reconcilePendingPayFastRefunds } from "@/src/modules/payments/refunds";

const workerState = globalThis as typeof globalThis & {
  __jurgensInvoiceWorker?: {
    running: boolean;
    timer: NodeJS.Timeout;
  };
};

export function startInvoiceWorker() {
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
