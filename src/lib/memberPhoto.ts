/**
 * Member photos are kept in the member's own record (members.profile_picture) as a small JPEG
 * data URL, so they work offline and travel with every backup. The chosen picture is cropped to a
 * centred square and scaled down to an avatar: a few tens of kilobytes whatever the original size.
 */
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const PHOTO_ACCEPT = PHOTO_TYPES.join(",");
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const SIZE = 256;

/** The photo for a member record, or throws an Error whose message can be shown as is. */
export async function photoFromFile(file: File): Promise<string> {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error("Choose a JPG, PNG, WebP or GIF picture.");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("The picture is larger than 20 MB. Choose a smaller one.");
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error("This picture could not be opened. Try another file.");
  }
  try {
    const side = Math.min(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("The picture could not be prepared.");
    // JPEG has no transparency: a transparent PNG gets a white background, not black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    image.close();
  }
}
