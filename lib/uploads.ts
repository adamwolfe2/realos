import { put, del, list } from "@vercel/blob";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export class UploadError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/**
 * Validate a file before uploading.
 * Throws UploadError if validation fails.
 */
export function validateFile(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new UploadError("File too large. Maximum size is 10MB.");
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new UploadError(
      "File type not allowed. Accepted: PDF, images (JPEG/PNG/WebP), CSV, Excel, Word.",
    );
  }
}

/**
 * Upload a file to Vercel Blob under a given path prefix.
 * Returns the blob URL.
 */
export async function uploadFile(
  file: File,
  pathPrefix: string,
): Promise<{ url: string; pathname: string }> {
  validateFile(file);

  const blob = await put(`${pathPrefix}/${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  return { url: blob.url, pathname: blob.pathname };
}

/**
 * Delete a file from Vercel Blob by URL.
 */
export async function deleteFile(url: string): Promise<void> {
  await del(url);
}

/**
 * List files in Vercel Blob under a given prefix.
 */
export async function listFiles(prefix: string) {
  const result = await list({ prefix });
  return result.blobs.map((b) => ({
    url: b.url,
    pathname: b.pathname,
    size: b.size,
    uploadedAt: b.uploadedAt,
  }));
}
