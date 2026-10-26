import { analyzeImage, GeminiError } from "../lib/gemini.mjs";
// Explicit one-off command. Never a default build hook. No secret values logged.
try {
  const response = await fetch("https://goo.gle/instrument-img", {
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error("FIXTURE_DOWNLOAD_FAILED");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const type =
    response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const result = await analyzeImage(bytes, type);
  if (result.relevant) throw Error("NEGATIVE_IMAGE_MISCLASSIFIED");
  console.log(
    "GEMINI_SMOKE " +
      JSON.stringify({
        ok: true,
        model: result.model,
        input: "Google documentation instrument sample",
        relevant: result.relevant,
        category: result.category,
        summary: result.summary,
        reason: result.reason,
      }),
  );
} catch (e) {
  console.error(
    "GEMINI_SMOKE " +
      JSON.stringify({
        ok: false,
        code: e instanceof GeminiError ? e.code : "TEST_FAILURE",
        message:
          e instanceof GeminiError
            ? e.message
            : "Foto sampel atau respons pengujian belum valid.",
      }),
  );
  process.exitCode = 1;
}
