import Link from "next/link";

const cls =
  "flex h-pill w-full items-center justify-center rounded-full bg-ink text-[18px] font-semibold text-on-ink transition active:scale-[0.98] disabled:opacity-40";

type Props = {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
};

export function PrimaryPill({ children, href, onClick, disabled, type = "button" }: Props) {
  if (href)
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}
