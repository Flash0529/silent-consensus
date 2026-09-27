"use client";

// Shrink a picked image in the browser to a small JPEG data URL before uploading (square crop for
// avatars). Keeps uploads light and strips any metadata (location, camera) from the original.
export async function toJpegDataUrl(file: File, max: number, opts: { square?: boolean; quality?: number } = {}) {
  if (!file.type.startsWith("image/")) throw new Error("Pick an image file.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Couldn't read that image."));
      i.src = url;
    });
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (opts.square) {
      const side = Math.min(sw, sh);
      sx = (sw - side) / 2;
      sy = (sh - side) / 2;
      sw = sh = side;
    }
    const scale = Math.min(1, max / Math.max(sw, sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", opts.quality ?? 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}
