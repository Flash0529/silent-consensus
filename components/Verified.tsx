// The verified check that only Hush gets (people can't put check marks in their names: lib/names.ts).
export function Verified({ size = 16, title = "Verified: this is really Hush" }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title} className="inline-block shrink-0">
      <title>{title}</title>
      <path
        fill="#0381FE"
        d="M12 1.5l2.4 1.8 3-.2 1 2.8 2.6 1.6-.7 2.9 1.2 2.7-2.2 2 .1 3-2.9.8-1.6 2.6-2.9-.8L12 22.5l-2-2.2-2.9.8-1.6-2.6-2.9-.8.1-3-2.2-2 1.2-2.7-.7-2.9 2.6-1.6 1-2.8 3 .2z"
      />
      <path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
