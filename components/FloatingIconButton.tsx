import Link from "next/link";

const cls =
  "flex h-float w-float shrink-0 items-center justify-center rounded-full bg-surface shadow-float transition active:scale-95 disabled:opacity-50";

type Props = { label: string; children: React.ReactNode; href?: string; onClick?: () => void; disabled?: boolean };

export function FloatingIconButton({ label, children, href, onClick, disabled }: Props) {
  if (href)
    return (
      <Link href={href} aria-label={label} className={cls}>
        {children}
      </Link>
    );
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}
