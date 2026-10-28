// Downscale photos before upload (SPEC §4): long edge 1600 px, JPEG q≈0.8.
// Keeps requests small and cheap; recipe text stays legible at this size.
const LONG_EDGE = 1600;
const QUALITY = 0.8;

export async function downscale(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", QUALITY);
}
