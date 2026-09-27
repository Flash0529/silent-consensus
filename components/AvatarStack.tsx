import { avatarStyle } from "@/lib/avatars";

type M = { id: string; name: string; avatarColor: string; photo?: string | null };

export function Avatar({ m, size = 28, ring = "rgb(var(--surface))", className = "" }: { m: M; size?: number; ring?: string; className?: string }) {
  const s = avatarStyle(m.avatarColor);
  if (m.photo)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={m.photo}
        alt=""
        aria-hidden="true"
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size, border: ring ? `2px solid ${ring}` : undefined }}
      />
    );
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        background: s.bg,
        color: s.fg,
        fontSize: Math.round(size * 0.4),
        border: ring ? `2px solid ${ring}` : undefined,
      }}
      aria-hidden="true"
    >
      {m.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function AvatarStack({ members, size = 28, ring = "rgb(var(--surface))", max = 5 }: { members: M[]; size?: number; ring?: string; max?: number }) {
  return (
    <div className="flex">
      {members.slice(0, max).map((m, i) => (
        <Avatar key={m.id} m={m} size={size} ring={ring} className={i ? "-ml-2" : ""} />
      ))}
    </div>
  );
}
