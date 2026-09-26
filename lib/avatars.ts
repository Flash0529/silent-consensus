export const AVATAR_ORDER = ["blue", "peach", "green", "lilac"] as const;
export type AvatarColor = (typeof AVATAR_ORDER)[number];

export const AVATAR_STYLES: Record<AvatarColor, { bg: string; fg: string }> = {
  peach: { bg: "#FFE3D3", fg: "#7A2E0E" },
  blue: { bg: "#DCE9FF", fg: "#0B3D91" },
  green: { bg: "#DDF3DC", fg: "#1E5B24" },
  lilac: { bg: "#EDE4FF", fg: "#4B1FA6" },
};

export function avatarFor(index: number): AvatarColor {
  return AVATAR_ORDER[index % AVATAR_ORDER.length];
}

export function avatarStyle(color: string) {
  return AVATAR_STYLES[(color as AvatarColor) in AVATAR_STYLES ? (color as AvatarColor) : "blue"];
}
