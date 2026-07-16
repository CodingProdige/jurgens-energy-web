import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { link, mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { env } from "@/src/config/env";
import {
  parseCreditNoteDocumentData,
  type CreditNoteDocumentData,
} from "@/src/modules/invoices/credit-note-document-data";
import { renderCreditNotePdf } from "@/src/modules/invoices/credit-note-pdf-document";

export type RenderedCreditNotePdf = Readonly<{
  buffer: Buffer;
  byteLength: number;
  sha256: string;
}>;

export type StoredCreditNotePdf = Readonly<{
  byteLength: number;
  created: boolean;
  relativePath: string;
  sha256: string;
}>;

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function creditNoteRelativePath(creditNoteNumber: string) {
  if (!/^CN[1-9]\d*$/.test(creditNoteNumber)) {
    throw new Error("Credit-note number cannot be used as a storage key.");
  }

  return `credit-notes/${creditNoteNumber}.pdf`;
}

function resolvePrivateCreditNotePath(relativePath: string) {
  if (!/^credit-notes\/CN[1-9]\d*\.pdf$/.test(relativePath)) {
    throw new Error("Invalid private credit-note storage path.");
  }

  const root = path.resolve(env.INVOICE_ROOT);
  const absolutePath = path.resolve(root, relativePath);
  const relativeToRoot = path.relative(root, absolutePath);

  if (
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot) ||
    relativeToRoot.length === 0
  ) {
    throw new Error("Credit-note path escaped the private invoice root.");
  }

  return { absolutePath, root };
}

async function readExistingCreditNote(
  absolutePath: string,
  relativePath: string,
  expectedSha256: string,
): Promise<StoredCreditNotePdf | null> {
  try {
    const buffer = await readFile(absolutePath);
    const existingSha256 = sha256(buffer);

    if (existingSha256 !== expectedSha256) {
      throw new Error(
        "An immutable credit note already exists at this path with different content.",
      );
    }

    return {
      byteLength: buffer.byteLength,
      created: false,
      relativePath,
      sha256: existingSha256,
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function renderCreditNotePdfWithChecksum(
  input: CreditNoteDocumentData | unknown,
): Promise<RenderedCreditNotePdf> {
  const buffer = await renderCreditNotePdf(input);

  if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error("Credit-note renderer did not return a valid PDF document.");
  }

  return {
    buffer,
    byteLength: buffer.byteLength,
    sha256: sha256(buffer),
  };
}

export async function storeCreditNotePdf(
  creditNoteNumber: string,
  pdf: RenderedCreditNotePdf,
): Promise<StoredCreditNotePdf> {
  const relativePath = creditNoteRelativePath(creditNoteNumber);
  const { absolutePath, root } = resolvePrivateCreditNotePath(relativePath);

  if (
    pdf.byteLength !== pdf.buffer.byteLength ||
    sha256(pdf.buffer) !== pdf.sha256
  ) {
    throw new Error("Credit-note PDF metadata does not match its content.");
  }

  const existing = await readExistingCreditNote(
    absolutePath,
    relativePath,
    pdf.sha256,
  );

  if (existing) {
    return existing;
  }

  await mkdir(root, { mode: 0o700, recursive: true });
  await mkdir(path.dirname(absolutePath), { mode: 0o700, recursive: true });

  const temporaryPath = path.join(
    path.dirname(absolutePath),
    `.${path.basename(relativePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const temporaryFile = await open(temporaryPath, "wx", 0o600);

  try {
    await temporaryFile.writeFile(pdf.buffer);
    await temporaryFile.sync();
  } finally {
    await temporaryFile.close();
  }

  try {
    await link(temporaryPath, absolutePath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      const concurrentResult = await readExistingCreditNote(
        absolutePath,
        relativePath,
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
    byteLength: pdf.byteLength,
    created: true,
    relativePath,
    sha256: pdf.sha256,
  };
}

export async function renderAndStoreCreditNotePdf(
  input: CreditNoteDocumentData | unknown,
): Promise<StoredCreditNotePdf> {
  const data = parseCreditNoteDocumentData(input);
  const pdf = await renderCreditNotePdfWithChecksum(data);

  return storeCreditNotePdf(data.creditNoteNumber, pdf);
}

export async function readStoredCreditNotePdf(
  relativePath: string,
  expectedSha256?: string,
): Promise<Buffer> {
  const { absolutePath } = resolvePrivateCreditNotePath(relativePath);
  const buffer = await readFile(absolutePath);

  if (expectedSha256 && sha256(buffer) !== expectedSha256) {
    throw new Error("Stored credit-note checksum verification failed.");
  }

  return buffer;
}
