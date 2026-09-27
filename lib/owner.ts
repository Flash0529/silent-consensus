import { getAccount } from "@/lib/account";

// The app owner(s): OWNER_EMAILS (comma-separated) in .env; defaults to the project owner.
export async function ownerAccount() {
  const a = await getAccount();
  if (!a) return null;
  const owners = (process.env.OWNER_EMAILS ?? "basu.shamit@gmail.com,basushamit@gmail.com").split(",").map((e) => e.trim().toLowerCase());
  return owners.includes(a.email.toLowerCase()) ? a : null;
}
