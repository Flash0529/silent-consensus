// Chat colors and background presets (chat settings).
export const CHAT_COLORS = ["#0381fe", "#5b3df5", "#e0457b", "#f07a2b", "#16a34a", "#0ea5a4", "#64748b", "#d4a017"];

export const BACKGROUNDS = [
  { key: "preset:none", label: "None" },
  { key: "preset:aurora", label: "Aurora" },
  { key: "preset:dusk", label: "Dusk" },
  { key: "preset:grid", label: "Grid" },
  { key: "preset:dots", label: "Dots" },
] as const;

export function bgStyle(key: string | null | undefined): React.CSSProperties | undefined {
  if (!key || key === "preset:none") return undefined;
  if (key.startsWith("data:")) return { backgroundImage: `linear-gradient(rgb(0 0 0 / .45), rgb(0 0 0 / .45)), url(${key})`, backgroundSize: "cover", backgroundPosition: "center" };
  switch (key) {
    case "preset:aurora":
      return { backgroundImage: "radial-gradient(60% 50% at 20% 10%, rgb(3 129 254 / .28), transparent), radial-gradient(50% 50% at 90% 80%, rgb(91 61 245 / .3), transparent)" };
    case "preset:dusk":
      return { backgroundImage: "linear-gradient(180deg, rgb(240 122 43 / .18), rgb(224 69 123 / .14) 45%, transparent)" };
    case "preset:grid":
      return { backgroundImage: "linear-gradient(rgb(255 255 255 / .05) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / .05) 1px, transparent 1px)", backgroundSize: "28px 28px" };
    case "preset:dots":
      return { backgroundImage: "radial-gradient(rgb(255 255 255 / .09) 1.2px, transparent 1.2px)", backgroundSize: "18px 18px" };
    default:
      return undefined;
  }
}
