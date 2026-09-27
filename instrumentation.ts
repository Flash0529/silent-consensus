// Runs once when the server starts: every hour, delete chat files older than 7 days.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { cleanupExpiredFiles } = await import("@/lib/files");
  const run = () => cleanupExpiredFiles().catch((e) => console.error("file cleanup failed", e));
  setTimeout(run, 30_000);
  setInterval(run, 60 * 60_000);
}
