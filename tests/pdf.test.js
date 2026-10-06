import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createPackagePdf } from "../src/lib/pdf.js";

async function createSourcePdf(sizes, label) {
  const document = await PDFDocument.create();
  sizes.forEach(([width, height], index) => {
    document.addPage([width, height]).drawText(`${label} page ${index + 1}`);
  });
  return document.save();
}

test("creates a cover and appends every source page in the requested order with a footer margin", async () => {
  const firstBytes = await createSourcePdf([[500, 700], [500, 700]], "FIRST DOCUMENT");
  const secondBytes = await createSourcePdf([[400, 600]], "SECOND DOCUMENT");
  const firstFile = { id: "first", name: "first.pdf", bytes: firstBytes };
  const secondFile = { id: "second", name: "second.pdf", bytes: secondBytes };
  const result = await createPackagePdf({
    tender: { tender_id: "T-TEST" },
    includedDocuments: [
      { requirement: { title_en: "First in order" }, file: firstFile },
      { requirement: { title_en: "Second in order" }, file: secondFile },
    ],
    filesById: new Map([["first", firstFile], ["second", secondFile]]),
    madeOn: "6 October 2026",
  });

  const packageDocument = await PDFDocument.load(result);
  const pages = packageDocument.getPages();
  assert.equal(pages.length, 4);
  assert.deepEqual(
    pages.map((page) => page.getSize()),
    [
      { width: 595.28, height: 841.89 },
      { width: 500, height: 736 },
      { width: 500, height: 736 },
      { width: 400, height: 636 },
    ],
  );

  const textDocument = await pdfjs.getDocument({
    data: result,
    disableWorker: true,
    verbosity: 0,
  }).promise;
  const pageTexts = [];
  for (let pageNumber = 1; pageNumber <= textDocument.numPages; pageNumber += 1) {
    const page = await textDocument.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => item.str).join(" "));
  }
  await textDocument.destroy();

  assert.ok(pageTexts[0].includes("Tender Document Package"));
  assert.ok(pageTexts[0].indexOf("1. First in order") < pageTexts[0].indexOf("2. Second in order"));
  assert.match(pageTexts[1], /FIRST DOCUMENT page 1/);
  assert.match(pageTexts[2], /FIRST DOCUMENT page 2/);
  assert.match(pageTexts[3], /SECOND DOCUMENT page 1/);
  pageTexts.forEach((text, index) => {
    assert.ok(text.includes(`T-TEST | Page ${index + 1} of 4`));
  });
});

test("creates a cover-only PDF when optional documents are not included", async () => {
  const result = await createPackagePdf({
    tender: { tender_id: "T-OPTIONAL" },
    includedDocuments: [],
    filesById: new Map(),
    madeOn: "6 October 2026",
  });
  const packageDocument = await PDFDocument.load(result);
  assert.equal(packageDocument.getPageCount(), 1);
});
