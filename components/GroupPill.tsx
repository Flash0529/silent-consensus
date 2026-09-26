import { AvatarStack } from "./AvatarStack";

export function GroupPill({ title, members }: { title: string; members: { id: string; name: string; avatarColor: string }[] }) {
  return (
    <div className="flex h-float min-w-0 items-center gap-[10px] rounded-full bg-surface pl-[10px] pr-[18px] shadow-float">
      <AvatarStack members={members} />
      <span className="truncate text-[17px] font-semibold">{title}</span>
    </div>
  );
}
