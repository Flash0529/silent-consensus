import QRCode from "qrcode";
import { db } from "@/lib/db";
import { jsonError, originOf } from "@/lib/http";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const circle = await db.circle.findUnique({ where: { slug }, select: { id: true } });
  if (!circle) return jsonError("Not found", 404);
  const svg = await QRCode.toString(`${originOf(req)}/j/${slug}`, {
    type: "svg",
    margin: 1,
    color: { dark: "#0B0B0C", light: "#FFFFFF" },
  });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } });
}
