import "server-only";

import { createHash, randomUUID } from "node:crypto";
import {
  link,
  mkdir,
  open,
  readFile,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import { env } from "@/src/config/env";
import {
  parseInvoiceDocumentData,
  type InvoiceDocumentData,
} from "@/src/modules/invoices/document-data";
import { renderInvoicePdf } from "@/src/modules/invoices/pdf-document";

export type RenderedInvoicePdf = Readonly<{
  buffer: Buffer;
  byteLength: number;
  sha256: string;
}>;

export type StoredInvoicePdf = Readonly<{
  relativePath: string;
  byteLength: number;
  sha256: string;
  created: boolean;
}>;

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function invoiceRelativePath(invoiceNumber: string) {
  if (!/^INV[1-9]\d*$/.test(invoiceNumber)) {
    throw new Error("Invoice number cannot be used as a storage key.");
  }

  return `${invoiceNumber}.pdf`;
}

function resolvePrivateInvoicePath(relativePath: string) {
  if (!/^INV[1-9]\d*\.pdf$/.test(relativePath)) {
    throw new Error("Invalid private invoice storage path.");
  }

  const root = path.resolve(env.INVOICE_ROOT);
  const absolutePath = path.resolve(root, relativePath);
  const relativeToRoot = path.relative(root, absolutePath);

  if (
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot) ||
    relativeToRoot.length === 0
  ) {
    throw new Error("Invoice path escaped the private invoice root.");
  }

  return { absolutePath, root };
}

async function readExistingInvoice(
  absolutePath: string,
  expectedSha256: string,
): Promise<StoredInvoicePdf | null> {
  try {
    const buffer = await readFile(absolutePath);
    const existingSha256 = sha256(buffer);

    if (existingSha256 !== expectedSha256) {
      throw new Error(
        "An immutable invoice already exists at this path with different content.",
      );
    }

    return {
      relativePath: path.basename(absolutePath),
      byteLength: buffer.byteLength,
      sha256: existingSha256,
      created: false,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

export async function renderInvoicePdfWithChecksum(
  input: InvoiceDocumentData | unknown,
): Promise<RenderedInvoicePdf> {
  const buffer = await renderInvoicePdf(input);

  if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error("Invoice renderer did not return a valid PDF document.");
  }

  return {
    buffer,
    byteLength: buffer.byteLength,
    sha256: sha256(buffer),
  };
}

export async function storeInvoicePdf(
  invoiceNumber: string,
  pdf: RenderedInvoicePdf,
): Promise<StoredInvoicePdf> {
  const relativePath = invoiceRelativePath(invoiceNumber);
  const { absolutePath, root } = resolvePrivateInvoicePath(relativePath);

  if (pdf.byteLength !== pdf.buffer.byteLength || sha256(pdf.buffer) !== pdf.sha256) {
    throw new Error("Invoice PDF metadata does not match its content.");
  }

  const existing = await readExistingInvoice(absolutePath, pdf.sha256);
  if (existing) {
    return existing;
  }

  await mkdir(root, { mode: 0o700, recursive: true });

  const temporaryPath = path.join(
    root,
    `.${relativePath}.${process.pid}.${randomUUID()}.tmp`,
  );
  const temporaryFile = await open(temporaryPath, "wx", 0o600);

  try {
    await temporaryFile.writeFile(pdf.buffer);
    await temporaryFile.sync();
  } finally {
    await temporaryFile.close();
  }

  try {
    // A hard link publishes the completed file atomically without replacing an
    // existing invoice. The temporary file lives on the same mounted volume.
    await link(temporaryPath, absolutePath);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "EEXIST"
    ) {
      const concurrentResult = await readExistingInvoice(
        absolutePath,
        pdf.sha256,
      );

      if (concurrentResult) {
        return concurrentResult;
      }
    }

    throw error;
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }

  return {
    relativePath,
    byteLength: pdf.byteLength,
    sha256: pdf.sha256,
    created: true,
  };
}

export async function renderAndStoreInvoicePdf(
  input: InvoiceDocumentData | unknown,
): Promise<StoredInvoicePdf> {
  const data = parseInvoiceDocumentData(input);
  const pdf = await renderInvoicePdfWithChecksum(data);

  return storeInvoicePdf(data.invoiceNumber, pdf);
}

export async function readStoredInvoicePdf(
  relativePath: string,
  expectedSha256?: string,
): Promise<Buffer> {
  const { absolutePath } = resolvePrivateInvoicePath(relativePath);
  const buffer = await readFile(absolutePath);

  if (expectedSha256 && sha256(buffer) !== expectedSha256) {
    throw new Error("Stored invoice checksum verification failed.");
  }

  return buffer;
}
