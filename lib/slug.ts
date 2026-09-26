import { customAlphabet } from "nanoid";

// No look-alike characters, so a code can be read aloud or typed.
export const newSlug = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 8);
