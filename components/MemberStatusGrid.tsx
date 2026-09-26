import { Avatar } from "./AvatarStack";
import { CheckIcon } from "./Icons";

type M = { id: string; name: string; avatarColor: string; interviewStatus: string };

export function MemberStatusGrid({ members }: { members: M[] }) {
  return (
    <ul className="grid grid-cols-4 gap-x-2 gap-y-4" aria-label="Who has finished">
      {members.map((m) => {
        const done = m.interviewStatus === "DONE";
        return (
          <li key={m.id} className="flex flex-col items-center gap-2">
            <div className="relative h-[58px] w-[58px]">
              <Avatar m={m} size={58} ring="" className={done ? "" : "opacity-60"} />
              {done ? (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white bg-ink">
                  <CheckIcon size={12} color="#FFFFFF" stroke={3.4} />
                </span>
              ) : (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-white bg-control">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" />
                </span>
              )}
            </div>
            <span className="max-w-full truncate text-secondary font-medium">{m.name}</span>
            <span className="sr-only">{done ? "finished" : "still chatting"}</span>
          </li>
        );
      })}
    </ul>
  );
}
