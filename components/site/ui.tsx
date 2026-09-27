import Link from "next/link";
import { Chevron } from "./icons";
import { Reveal } from "./motion";

export const FRIENDS = [
  { name: "Omar", color: "#FFE3D3", ink: "#7A2E0E" },
  { name: "Maya", color: "#EDE4FF", ink: "#4B1FA6" },
  { name: "Priya", color: "#DDF3DC", ink: "#1E5B24" },
  { name: "Jordan", color: "#DCE9FF", ink: "#0B3D91" },
];

export function Avatar({
  name,
  color,
  ink,
  size = 40,
  ring = false,
}: {
  name: string;
  color: string;
  ink: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${ring ? "ring-[3px] ring-obsidian" : ""}`}
      style={{ width: size, height: size, background: color, color: ink, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {name[0]}
    </span>
  );
}

/** Small section label above a headline (Galaxy "product-label"). */
export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-product text-ash ${className}`}>{children}</p>;
}

/** Text-only release marker. Never a badge container. */
export function NewMarker({ children = "New" }: { children?: React.ReactNode }) {
  return <span className="text-micro font-semibold text-amber">{children}</span>;
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  center = false,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`max-w-[880px] ${center ? "mx-auto text-center" : ""}`}>
      {eyebrow && (
        <Reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
        </Reveal>
      )}
      <Reveal delay={0.05}>
        <h2 className="mt-3 text-balance text-[40px] font-semibold leading-[1.08] tracking-[-0.6px] sm:text-display-sm lg:text-display-md text-porcelain">
          {title}
        </h2>
      </Reveal>
      {sub && (
        <Reveal delay={0.12}>
          <p
            className={`mt-5 text-pretty text-[19px] leading-[1.42] tracking-[0.012em] sm:text-label sm:font-normal text-ash ${center ? "mx-auto max-w-[680px]" : "max-w-[680px]"}`}
          >
            {sub}
          </p>
        </Reveal>
      )}
    </div>
  );
}

/** Muted continuation of a headline ("What admins see. <Muted>And what they never will.</Muted>"). */
export function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-ash">{children}</span>;
}

type PillVariant = "blue" | "outline" | "porcelain";

const PILL: Record<PillVariant, string> = {
  // Galaxy Blue is reserved for the conversion path.
  blue: "bg-galaxy text-white hover:bg-galaxy-hover",
  outline: "text-porcelain shadow-[inset_0_0_0_1px_#6e6e73] hover:bg-porcelain/[.08]",
  porcelain: "bg-porcelain text-obsidian hover:bg-porcelain/90",
};

export function pillClass(variant: PillVariant = "blue", size: "md" | "sm" = "md") {
  const s = size === "md" ? "h-11 px-[22px] text-lead" : "h-[30px] px-[14px] text-micro";
  return `inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-normal transition-colors duration-200 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 ${s} ${PILL[variant]}`;
}

export function PillLink({
  href,
  children,
  variant = "blue",
  size = "md",
}: {
  href: string;
  children: React.ReactNode;
  variant?: PillVariant;
  size?: "md" | "sm";
}) {
  return (
    <Link href={href} className={pillClass(variant, size)}>
      {children}
    </Link>
  );
}

/** Link with a chevron. `link` is Electric Link on dark themes and Cobalt Link on the light theme. */
export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex h-11 items-center gap-0.5 text-lead text-link hover:underline">
      {children}
      <Chevron size={17} className="transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Translucent capsule for pricing / availability, paired beside the blue pill. */
export function Capsule({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-11 items-center rounded-capsule bg-[rgba(66,66,69,0.72)] px-5 text-body-sm text-white/80 glass">
      {children}
    </span>
  );
}

/** Black feature tile (24px, no shadow). Sits inside Carbon panels. */
export function Tile({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`h-full rounded-tile bg-obsidian p-7 sm:p-8 ${className}`}>{children}</div>;
}

/** Carbon comparison panel (24px, no shadow). */
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-tile bg-carbon p-3 sm:p-4 ${className}`}>{children}</div>;
}
