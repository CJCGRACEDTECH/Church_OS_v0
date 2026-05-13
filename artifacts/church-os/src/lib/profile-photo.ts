const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_SIZE = 512;
const PROFILE_PHOTO_PATTERN = /^(https?:\/\/|data:image\/(?:png|jpe?g|webp|gif);base64,)/i;

export function isProfilePhotoValue(value: string) {
  return value === "" || PROFILE_PHOTO_PATTERN.test(value);
}

export async function readProfilePhotoFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Choose an image smaller than 8 MB.");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_IMAGE_SIZE / image.width, MAX_IMAGE_SIZE / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not process this image.");
    }

    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read this image."));
    image.src = src;
  });
}
