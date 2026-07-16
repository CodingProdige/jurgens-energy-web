export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startInvoiceWorker } = await import(
      "./src/modules/invoices/worker"
    );
    startInvoiceWorker();
  }
}
