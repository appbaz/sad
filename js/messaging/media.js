import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_DATA_URL_LENGTH,
} from "../constants.js";

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("ছবি রূপান্তর করা যায়নি"));
    reader.readAsDataURL(blob);
  });
}

function compressToBlob(img, width, height, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("ছবি প্রসেস করা যায়নি"));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality
    );
  });
}

export function compressImage(file, maxDim = MAX_IMAGE_DIMENSION) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("শুধু ছবি ফাইল গ্রহণযোগ্য"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error("ছবির সাইজ ৫ MB এর বেশি হতে পারবে না"));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(url);
      try {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const qualities = [0.82, 0.72, 0.62, 0.52, 0.42];
        let best = null;

        for (const quality of qualities) {
          const blob = await compressToBlob(img, width, height, quality);
          const dataUrl = await blobToDataUrl(blob);
          best = { blob, width, height, dataUrl, bytes: blob.size };

          if (dataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH) {
            resolve(best);
            return;
          }

          if (width > 640) {
            width = Math.round(width * 0.8);
            height = Math.round(height * 0.8);
          }
        }

        if (best && best.dataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH) {
          resolve(best);
          return;
        }

        reject(
          new Error(
            "ছবি খুব বড় — ছোট ছবি বেছে নিন (Firestore ফ্রি মোডে সীমা ~৪০০ KB)"
          )
        );
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("ছবি লোড করা যায়নি"));
    };
    img.src = url;
  });
}

/** Firebase Storage ছাড়াই Firestore-এ inline ছবি (data URL) */
export async function prepareImageForMessage(file, onProgress) {
  onProgress?.(0.2);
  const result = await compressImage(file);
  onProgress?.(0.85);

  if (result.dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error("ছবি খুব বড় — আরও ছোট ছবি পাঠান");
  }

  onProgress?.(1);
  return {
    imageUrl: result.dataUrl,
    imageThumbUrl: result.dataUrl,
    width: result.width,
    height: result.height,
  };
}
