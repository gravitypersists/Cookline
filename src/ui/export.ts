import { toBlob } from "html-to-image";

// Export the map as a PNG (SPEC §6.5): the share sheet where the browser can
// share files, otherwise a download.
export async function exportPng(node: HTMLElement, title: string): Promise<void> {
  const background = getComputedStyle(document.body).backgroundColor;
  const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: background, cacheBust: false });
  if (!blob) throw new Error("Couldn't render the image.");
  const name = `${title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "recipe"}.png`;
  const file = new File([blob], name, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // closed the share sheet
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
