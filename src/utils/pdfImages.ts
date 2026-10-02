import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Renders every page of a PDF to a PNG, for sharing where a PDF doesn't preview in the chat
 * (WhatsApp). At scale 2 an A4 page is about 1190 × 1684 pixels: sharp enough to read figures on
 * a phone after WhatsApp compresses it. Loaded on demand (it pulls in pdf.js).
 */
export async function pdfToPngPages(pdf: ArrayBuffer, scale = 2): Promise<ArrayBuffer[]> {
  // pdf.js takes ownership of the bytes it is given, so it gets a copy.
  const doc = await getDocument({ data: new Uint8Array(pdf.slice(0)) }).promise;
  try {
    const pages: ArrayBuffer[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("The page could not be drawn.");
      // A PDF page has no background of its own; a picture of it needs a white one.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The page could not be saved as a picture."))), "image/png"),
      );
      pages.push(await blob.arrayBuffer());
      page.cleanup();
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}
