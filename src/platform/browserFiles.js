/**
 * Browser-only file helpers. Callers check `Platform.OS === "web"` first;
 * nothing here touches `document` until it is called.
 */

/**
 * Prints a standalone HTML document — the PDF report — through the browser's
 * print dialog, where "Save as PDF" is always offered.
 *
 * expo-print's own web `printToFileAsync` just calls window.print() on the
 * *app* page, so the report is written into a hidden iframe and printed from
 * there instead. An iframe rather than window.open: no popup blocker applies.
 */
export function printHtml(html, { title } = {}) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    Object.assign(frame.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "0",
      height: "0",
      border: "0",
      visibility: "hidden",
    });

    const cleanup = () => setTimeout(() => frame.remove(), 1000);

    frame.onload = () => {
      try {
        const view = frame.contentWindow;
        if (title) {
          // Becomes the suggested file name in "Save as PDF".
          view.document.title = title;
        }
        view.addEventListener("afterprint", cleanup, { once: true });
        view.focus();
        view.print();
        resolve();
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}

/** Saves a data: or blob: URL as a file through a temporary download link. */
export function downloadUrl(url, fileName) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
