import Link from "next/link";
import { HushMascot } from "@/components/HushMascot";

// Replaces Next's built-in 404, whose inline dark-mode CSS turned the body black
// while the app column stayed white: the "blank white strip".
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
      <HushMascot size={72} />
      <h1 className="text-card-title">Nothing here</h1>
      <p className="text-body text-muted">That page doesn't exist.</p>
      <Link href="/" className="font-medium underline">
        Go home
      </Link>
    </main>
  );
}
