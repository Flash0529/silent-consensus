import Link from "next/link";
import { HushMascot } from "@/components/HushMascot";

// The Silent Consensus logo: the Hush bubble + wordmark.
export function BrandLogo({ size = 26, href = "/start", className = "" }: { size?: number; href?: string | null; className?: string }) {
  const inner = (
    <>
      <HushMascot size={size} />
      <span className="text-[15px] font-bold tracking-[-0.01em]">Silent Consensus</span>
    </>
  );
  return href ? (
    <Link href={href} aria-label="Silent Consensus home" className={`inline-flex items-center gap-2 ${className}`}>
      {inner}
    </Link>
  ) : (
    <span className={`inline-flex items-center gap-2 ${className}`}>{inner}</span>
  );
}
