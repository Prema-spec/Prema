export async function inspectPdf(file) {
  const bytes = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, "0")).join("");

  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes.slice(0)),
    isEvalSupported: false,
    useSystemFonts: true,
  });
  let pageCount;
  try {
    const document = await task.promise;
    pageCount = document.numPages;
  } finally {
    await task.destroy();
  }

  return { bytes, hash, pageCount };
}

function trimToWidth(text, font, fontSize, maxWidth) {
  const value = String(text ?? "");
  if (font.widthOfTextAtSize(value, fontSize) <= maxWidth) return value;

  let result = value;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}...`, fontSize) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}...`;
}

export async function createPackagePdf({ tender, includedDocuments, filesById, madeOn }) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const packagePdf = await PDFDocument.create();
  const font = await packagePdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await packagePdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const footerSpace = 36;
  const footerFontSize = 9;
  const pageRecords = [];

  const cover = packagePdf.addPage([pageWidth, pageHeight]);
  pageRecords.push(cover);
  let y = pageHeight - 50;

  cover.drawText("Tender Document Package", {
    x: 42,
    y,
    size: 21,
    font: boldFont,
    color: rgb(0.08, 0.22, 0.2),
  });
  y -= 34;

  const details = [
    ["Tender ID", tender.tender_id],
    ["Tender title", tender.title],
    ["Procuring entity", tender.procuring_entity],
    ["Bidder name", tender.bidder],
    ["Submission deadline", tender.submission_deadline],
    ["Package made on", madeOn],
  ];

  for (const [label, value] of details) {
    const line = `${label}: ${value}`;
    cover.drawText(trimToWidth(line, font, 10, pageWidth - 84), {
      x: 42,
      y,
      size: 10,
      font,
      color: rgb(0.16, 0.21, 0.2),
    });
    y -= 18;
  }

  y -= 8;
  cover.drawText("Included documents (in final order)", {
    x: 42,
    y,
    size: 12,
    font: boldFont,
    color: rgb(0.08, 0.22, 0.2),
  });
  y -= 21;

  const availableRows = Math.max(1, Math.floor((y - (footerSpace + 14)) / 14));
  const rowHeight = Math.min(14, (y - (footerSpace + 14)) / Math.max(1, includedDocuments.length));
  const listFontSize = includedDocuments.length > availableRows ? 7 : 9;
  const maxTextWidth = pageWidth - 94;

  includedDocuments.forEach((document, index) => {
    const title = trimToWidth(
      `${index + 1}. ${document.requirement.title_en}`,
      font,
      listFontSize,
      maxTextWidth,
    );
    cover.drawText(title, {
      x: 48,
      y,
      size: listFontSize,
      font,
      color: rgb(0.16, 0.21, 0.2),
    });
    y -= rowHeight;
  });

  for (const document of includedDocuments) {
    const sourceFile = filesById.get(document.file.id);
    if (!sourceFile?.bytes) {
      throw new Error(`The PDF data for "${document.file.name}" is no longer available. Please upload it again.`);
    }

    const sourcePdf = await PDFDocument.load(sourceFile.bytes, { updateMetadata: false });
    const sourceDocumentPages = sourcePdf.getPages();
    sourceDocumentPages.forEach((page) => page.translateContent(0, 0));
    const sourcePages = await packagePdf.embedPages(sourceDocumentPages);
    for (const sourcePage of sourcePages) {
      const page = packagePdf.addPage([
        sourcePage.width,
        sourcePage.height + footerSpace,
      ]);
      page.drawPage(sourcePage, { x: 0, y: footerSpace });
      pageRecords.push(page);
    }
  }

  const totalPages = pageRecords.length;
  pageRecords.forEach((page, index) => {
    const footer = `${tender.tender_id} | Page ${index + 1} of ${totalPages}`;
    const fontSize = footerFontSize;
    const textWidth = font.widthOfTextAtSize(footer, fontSize);
    page.drawLine({
      start: { x: 35, y: 27 },
      end: { x: page.getWidth() - 35, y: 27 },
      thickness: 0.5,
      color: rgb(0.78, 0.82, 0.8),
    });
    page.drawText(footer, {
      x: Math.max(35, (page.getWidth() - textWidth) / 2),
      y: 12,
      size: fontSize,
      font,
      color: rgb(0.19, 0.27, 0.25),
    });
  });

  return packagePdf.save();
}
