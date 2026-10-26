export class AnalysisRequestError extends Error {
  constructor(message, code = "REQUEST_FAILED", retryAfter = 0) {
    super(message);
    this.code = code;
    this.retryAfter = retryAfter;
  }
}
export function validatePhoto(file) {
  if (!file || !file.size)
    return "Pilih foto JPG, PNG, atau WebP yang tidak kosong.";
  if (file.size > 4194304)
    return "Foto maksimal 4 MB. Pilih foto dengan ukuran lebih kecil.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return "Format foto belum didukung. Gunakan JPG, PNG, atau WebP.";
  return null;
}
export async function photoFingerprint(file) {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return (
    file.type +
    ":" +
    Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")
  );
}
/**
 * @param {File} file
 * @param {{signal?:AbortSignal,onPhase?:(phase:'uploading'|'analyzing')=>void,createRequest?:()=>XMLHttpRequest}} options
 */
export function sendPhotoForAnalysis(file, options = {}) {
  const {
    signal,
    onPhase = () => {},
    createRequest = () => new XMLHttpRequest(),
  } = options;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Dibatalkan", "AbortError"));
      return;
    }
    const request = createRequest();
    let settled = false;
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const abort = () => request.abort();
    request.open("POST", "/api/analyze");
    request.timeout = 60000;
    signal?.addEventListener("abort", abort, { once: true });
    request.upload.onload = () => {
      if (!settled && !signal?.aborted && request.readyState !== 4)
        onPhase("analyzing");
    };
    request.onerror = () =>
      fail(
        new AnalysisRequestError(
          "Koneksi analisis terputus. Foto tetap tersedia; periksa koneksi lalu coba lagi.",
          "CONNECTION_ERROR",
        ),
      );
    request.ontimeout = () =>
      fail(
        new AnalysisRequestError(
          "Analisis melewati batas waktu. Foto tetap tersedia; silakan coba lagi.",
          "TIMEOUT",
        ),
      );
    request.onabort = () => fail(new DOMException("Dibatalkan", "AbortError"));
    request.onload = () => {
      let data;
      try {
        data = JSON.parse(request.responseText);
      } catch {
        fail(
          new AnalysisRequestError(
            request.status === 413
              ? "Foto maksimal 4 MB. Pilih foto dengan ukuran lebih kecil."
              : "Layanan analisis belum memberi respons yang lengkap. Silakan coba lagi.",
            "INVALID_RESPONSE",
          ),
        );
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        const retryAfter = Number(
          data.retryAfter || request.getResponseHeader("Retry-After") || 0,
        );
        fail(
          new AnalysisRequestError(
            typeof data.error === "string"
              ? data.error
              : "Analisis belum berhasil. Foto tetap tersedia; silakan coba lagi.",
            data.code || "REQUEST_FAILED",
            Number.isFinite(retryAfter)
              ? Math.min(3600, Math.max(0, retryAfter))
              : 0,
          ),
        );
        return;
      }
      if (
        typeof data.relevant !== "boolean" ||
        ![
          "category",
          "severity",
          "priority",
          "summary",
          "reason",
          "model",
        ].every((name) => typeof data[name] === "string" && data[name].trim())
      ) {
        fail(
          new AnalysisRequestError(
            "Hasil analisis belum lengkap. Foto tetap tersedia; silakan coba lagi.",
            "INVALID_RESULT",
          ),
        );
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data);
    };
    onPhase("uploading");
    const form = new FormData();
    form.set("file", file);
    request.send(form);
  });
}
