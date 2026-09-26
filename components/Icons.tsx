type P = { size?: number; color?: string; stroke?: number; className?: string };

const base = (size: number, color: string, stroke: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color,
  strokeWidth: stroke,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const BackIcon = ({ size = 22, color = "#0B0B0C", stroke = 2.4 }: P) => (
  <svg {...base(size, color, stroke)}><polyline points="15 18 9 12 15 6" /></svg>
);
export const CloseIcon = ({ size = 22, color = "#0B0B0C", stroke = 2.2 }: P) => (
  <svg {...base(size, color, stroke)}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
);
export const LockIcon = ({ size = 13, color = "#6E6E73", stroke = 2.6 }: P) => (
  <svg {...base(size, color, stroke)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const CheckIcon = ({ size = 18, color = "#0B0B0C", stroke = 2.6 }: P) => (
  <svg {...base(size, color, stroke)}><polyline points="5 12 10 17 19 8" /></svg>
);
export const MicIcon = ({ size = 20, color = "#3A3A3C", stroke = 2.2 }: P) => (
  <svg {...base(size, color, stroke)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><line x1="12" y1="18" x2="12" y2="21" /></svg>
);
export const PlusIcon = ({ size = 22, color = "#0B0B0C", stroke = 2.2 }: P) => (
  <svg {...base(size, color, stroke)}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
export const SendIcon = ({ size = 20, color = "#FFFFFF", stroke = 2.4 }: P) => (
  <svg {...base(size, color, stroke)}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="6 11 12 5 18 11" /></svg>
);
export const GroupIcon = ({ size = 22, color = "#0B0B0C", stroke = 2.1 }: P) => (
  <svg {...base(size, color, stroke)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
    <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4" />
    <path d="M18 14.8c1.9.6 3.1 2.3 3.5 5.2" />
  </svg>
);
export const ShareIcon = ({ size = 21, color = "#0B0B0C", stroke = 2.2 }: P) => (
  <svg {...base(size, color, stroke)}><path d="M12 3v12" /><polyline points="8 7 12 3 16 7" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
);
export const DotsIcon = ({ size = 22, color = "#0B0B0C" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
  </svg>
);
export const CalendarIcon = ({ size = 16, color = "#3A3A3C", stroke = 2.2 }: P) => (
  <svg {...base(size, color, stroke)}><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" /></svg>
);
export const CopyIcon = ({ size = 20, color = "#0B0B0C", stroke = 2.2 }: P) => (
  <svg {...base(size, color, stroke)}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
);
export const PlayIcon = ({ size = 16, color = "#FFFFFF" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
);
export const PauseIcon = ({ size = 16, color = "#FFFFFF" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
);
export const StopIcon = ({ size = 16, color = "#FFFFFF" }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
);
