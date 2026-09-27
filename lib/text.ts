// Cutting text safely: never in the middle of an emoji. Slicing a JS string by length can split an
// emoji's surrogate pair, and Postgres/Prisma rejects the broken half ("unexpected end of hex escape").
export function clip(s: string | null | undefined, max: number): string {
  if (!s) return "";
  const chars = Array.from(s);
  const cut = chars.length > max ? chars.slice(0, max).join("") : s;
  return cut.toWellFormed();
}
export const clipOrNull = (s: string | null | undefined, max: number) => (s ? clip(s, max) : null);
