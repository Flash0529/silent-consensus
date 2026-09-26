import { HushMascot } from "./HushMascot";
import { LockIcon } from "./Icons";

export function BotPill() {
  return (
    <div className="flex h-float items-center gap-[9px] rounded-full bg-surface pl-[9px] pr-[18px] shadow-float">
      <HushMascot size={34} />
      <span className="text-[18px] font-semibold">Hush</span>
      <span className="flex items-center gap-1 text-caption font-medium text-muted">
        <LockIcon />
        Private
      </span>
    </div>
  );
}
