"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mutate as globalMutate } from "swr";
import { api } from "@/lib/client";
import { useCircle, useMe } from "@/lib/useCircle";
import { Avatar } from "@/components/AvatarStack";
import { toJpegDataUrl } from "@/lib/image";
import { DesktopShell } from "@/components/DesktopShell";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { BackIcon, DotsIcon } from "@/components/Icons";
import { AvatarStack } from "@/components/AvatarStack";
import { CHAT_COLORS, BACKGROUNDS, bgStyle } from "@/lib/chatLook";

// Chat settings: name, color, background and chat photo (shared by everyone in the chat); the people
// in it (admins can add, remove and make admins); leaving and deleting the chat.
export default function ChatSettings({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { data: circle, mutate } = useCircle(slug);
  const { data: me } = useMe(slug);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "me" | "everyone" | "leave">(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);

  const save = async (patch: Record<string, unknown>, ok: string) => {
    setMsg(null);
    try {
      await api(`/api/circles/${slug}/settings`, { method: "PATCH", body: JSON.stringify(patch) });
      await mutate();
      globalMutate("/api/auth/me");
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." });
    }
  };
  const pick = async (file: File | undefined, kind: "photo" | "bg") => {
    if (!file) return;
    try {
      const url = kind === "photo" ? await toJpegDataUrl(file, 256, { square: true }) : await toJpegDataUrl(file, 1280, { quality: 0.72 });
      await save(kind === "photo" ? { photo: url } : { bgImage: url }, kind === "photo" ? "Chat photo updated." : "Background updated.");
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't use that image." });
    }
  };

  if (!circle) return <DesktopShell active={slug}><main className="p-8 text-secondary text-muted">Loading…</main></DesktopShell>;
  const dm = circle.isDirect;
  const name = title ?? circle.title;
  const myId = me?.member?.id;
  const amAdmin = !!circle.members.find((m) => m.id === myId)?.isAdmin;
  const canDeleteAll = amAdmin && !dm; // the server also refuses for the demo company

  const memberAction = async (id: string, action: "remove" | "promote" | "demote", ok: string) => {
    setMenuFor(null);
    setMsg(null);
    try {
      await api(`/api/circles/${slug}/members/${id}`, { method: "POST", body: JSON.stringify({ action }) });
      await mutate();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't do that." });
    }
  };
  const finish = async (kind: "me" | "everyone" | "leave") => {
    setBusy(true);
    setMsg(null);
    try {
      if (kind === "leave") await api(`/api/circles/${slug}/leave`, { method: "POST" });
      else await api(`/api/circles/${slug}/delete`, { method: "POST", body: JSON.stringify({ scope: kind }) });
      await globalMutate("/api/auth/me");
      router.push("/start");
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't do that." });
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <DesktopShell active={slug}>
      <main className="flex min-h-dvh flex-col px-5 pb-16 pt-6 lg:mx-auto lg:max-w-xl lg:pt-10">
        <div className="mb-4">
          <FloatingIconButton label="Back to the chat" href={`/c/${slug}/group`}>
            <BackIcon />
          </FloatingIconButton>
        </div>
        <h1 className="text-title">Chat settings</h1>
        {msg && <p className={`mt-2 text-secondary ${msg.ok ? "text-galaxy" : "text-danger"}`}>{msg.text}</p>}

        {!dm && (
          <section className="mt-6 flex items-center gap-4 rounded-2xl bg-bubble p-4">
            {circle.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={circle.photo} alt="" className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <AvatarStack members={circle.members} size={40} max={3} />
            )}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => photoInput.current?.click()} className="text-left text-body font-semibold text-galaxy">
                {circle.photo ? "Change chat photo" : "Add a chat photo"}
              </button>
              {circle.photo && (
                <button type="button" onClick={() => save({ photo: null }, "Chat photo removed.")} className="text-left text-secondary text-muted">
                  Remove photo
                </button>
              )}
              <input ref={photoInput} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0], "photo")} />
            </div>
          </section>
        )}

        {!dm && (
          <form
            className="mt-4 flex gap-2 rounded-2xl bg-bubble p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) save({ title: name.trim() }, "Chat renamed.");
            }}
          >
            <label className="grow">
              <span className="mb-1 block text-caption text-muted">Chat name</span>
              <input value={name} maxLength={60} onChange={(e) => setTitle(e.target.value)} className="h-11 w-full rounded-xl bg-surface px-3.5 text-body text-ink outline-none focus:outline-1 focus:outline-galaxy" />
            </label>
            <button className="h-11 self-end rounded-full bg-galaxy px-4 text-secondary font-semibold text-white disabled:opacity-40" disabled={!name.trim() || name.trim() === circle.title}>
              Save
            </button>
          </form>
        )}

        <section className="mt-4 rounded-2xl bg-bubble p-4">
          <p className="mb-3 text-caption text-muted">Color</p>
          <div className="flex flex-wrap gap-3">
            {CHAT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => save({ color: c }, "Color updated.")}
                className={`h-10 w-10 rounded-full ring-offset-2 ring-offset-bubble ${circle.color === c || (!circle.color && c === CHAT_COLORS[0]) ? "ring-2 ring-ink" : ""}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-2xl bg-bubble p-4">
          <p className="mb-3 text-caption text-muted">Background</p>
          <div className="grid grid-cols-3 gap-3">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => save({ bgImage: b.key }, "Background updated.")}
                className={`flex h-20 items-end rounded-xl border p-2 text-left text-caption font-semibold ${(circle.bgImage ?? "preset:none") === b.key ? "border-galaxy" : "border-hairline"}`}
                style={bgStyle(b.key)}
              >
                {b.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => bgInput.current?.click()}
              className={`flex h-20 items-center justify-center rounded-xl border border-dashed text-caption font-semibold text-muted ${circle.bgImage?.startsWith("data:") ? "border-galaxy" : "border-hairline"}`}
              style={circle.bgImage?.startsWith("data:") ? bgStyle(circle.bgImage) : undefined}
            >
              Your photo
            </button>
            <input ref={bgInput} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0], "bg")} />
          </div>
        </section>

        <RoomHush slug={slug} hush={circle.hush} onSaved={() => mutate()} />

        {!dm && (
          <section className="mt-4 rounded-2xl bg-bubble p-4">
            <div className="mb-2 flex items-center">
              <p className="grow text-caption text-muted">
                {circle.members.length} {circle.members.length === 1 ? "person" : "people"}
                {amAdmin ? " · you're an admin" : ""}
              </p>
              {amAdmin && (
                <Link href={`/c/${slug}/add`} className="rounded-full bg-galaxy px-3 py-1.5 text-caption font-semibold text-white hover:bg-galaxy-hover">
                  Add people
                </Link>
              )}
            </div>
            <ul className="flex flex-col">
              {circle.members.map((m) => (
                <li key={m.id} className="relative flex items-center gap-3 py-2">
                  <Avatar m={m} size={36} />
                  <span className="min-w-0 grow">
                    <span className="block truncate text-body font-medium">
                      {m.name}
                      {m.id === myId ? " (you)" : ""}
                    </span>
                    {m.isAdmin && <span className="text-caption font-semibold text-galaxy">Admin</span>}
                  </span>
                  {amAdmin && m.id !== myId && (
                    <button
                      type="button"
                      aria-label={`Options for ${m.name}`}
                      onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-hairline"
                    >
                      <DotsIcon size={18} />
                    </button>
                  )}
                  {menuFor === m.id && (
                    <div role="menu" className="absolute right-0 top-11 z-10 w-[220px] overflow-hidden rounded-2xl border border-hairline bg-surface shadow-float">
                      {m.isAdmin ? (
                        <button role="menuitem" type="button" onClick={() => memberAction(m.id, "demote", `${m.name} is no longer an admin.`)} className="block w-full px-4 py-3 text-left text-body hover:bg-bubble">
                          Remove as admin
                        </button>
                      ) : (
                        <button role="menuitem" type="button" onClick={() => memberAction(m.id, "promote", `${m.name} is now an admin.`)} className="block w-full px-4 py-3 text-left text-body hover:bg-bubble">
                          Make admin
                        </button>
                      )}
                      <button role="menuitem" type="button" onClick={() => memberAction(m.id, "remove", `${m.name} was removed.`)} className="block w-full border-t border-divider px-4 py-3 text-left text-body text-danger hover:bg-bubble">
                        Remove from group
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {!amAdmin && <p className="mt-2 text-caption text-muted">Only admins can add or remove people. If the last admin leaves, whoever&apos;s been here longest takes over.</p>}
          </section>
        )}

        <section className="mt-4 overflow-hidden rounded-2xl bg-bubble">
          {confirm ? (
            <div className="p-4">
              <p className="text-body font-semibold">
                {confirm === "everyone" ? "Delete this chat for everyone?" : confirm === "leave" ? "Leave this group?" : "Delete this chat?"}
              </p>
              <p className="mt-1 text-caption text-muted">
                {confirm === "everyone"
                  ? "The chat, its messages, cards and everyone's private answers are gone for everybody. This can't be undone."
                  : confirm === "leave"
                    ? "You'll stop getting its messages. Your messages stay in the chat."
                    : "Its messages disappear for you. If someone sends something new, the chat comes back with just that."}
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setConfirm(null)} className="h-10 grow rounded-full bg-surface text-secondary font-semibold">
                  Cancel
                </button>
                <button type="button" disabled={busy} onClick={() => finish(confirm)} className="h-10 grow rounded-full bg-danger text-secondary font-semibold text-white disabled:opacity-60">
                  {busy ? "One sec…" : confirm === "leave" ? "Leave" : "Delete"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" onClick={() => setConfirm("me")} className="block w-full px-4 py-3.5 text-left text-body font-medium text-danger hover:bg-hairline">
                Delete chat
                <span className="block text-caption font-normal text-muted">Clears it for you only</span>
              </button>
              {!dm && (
                <button type="button" onClick={() => setConfirm("leave")} className="block w-full border-t border-divider px-4 py-3.5 text-left text-body font-medium text-danger hover:bg-hairline">
                  Leave group
                </button>
              )}
              {canDeleteAll && (
                <button type="button" onClick={() => setConfirm("everyone")} className="block w-full border-t border-divider px-4 py-3.5 text-left text-body font-medium text-danger hover:bg-hairline">
                  Delete for everyone
                  <span className="block text-caption font-normal text-muted">Admins only</span>
                </button>
              )}
            </>
          )}
        </section>
      </main>
    </DesktopShell>
  );
}

/** "Hush in this chat": what this group calls Hush, and how it behaves here (everyone in the chat sees it). */
function RoomHush({ slug, hush, onSaved }: { slug: string; hush: { botName: string; tone: string; proactivity: string; emoji: boolean }; onSaved: () => void }) {
  const [name, setName] = useState(hush.botName);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async (patch: Record<string, unknown>, ok: string) => {
    setMsg(null);
    try {
      await api(`/api/circles/${slug}/settings`, { method: "PATCH", body: JSON.stringify({ hushStyle: patch }) });
      onSaved();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." });
    }
  };
  const seg = (key: "tone" | "proactivity", options: [string, string][]) => (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-surface p-1">
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={hush[key] === v} onClick={() => save({ [key]: v }, "Saved.")} className={`min-h-9 rounded-full px-2 text-caption font-semibold ${hush[key] === v ? "bg-bubble text-ink shadow-sm" : "text-muted"}`}>
          {l}
        </button>
      ))}
    </div>
  );
  return (
    <section className="mt-4 rounded-2xl bg-bubble p-4">
      <p className="text-caption text-muted">Hush in this chat · everyone here sees these</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save({ botName: name.trim() }, "Renamed.");
        }}
      >
        <label className="grow">
          <span className="mb-1 block text-caption text-muted">What this group calls Hush</span>
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} className="h-11 w-full rounded-xl bg-surface px-3.5 text-body text-ink outline-none focus:outline-1 focus:outline-galaxy" />
        </label>
        <button className="h-11 self-end rounded-full bg-galaxy px-4 text-secondary font-semibold text-white disabled:opacity-40" disabled={!name.trim() || name.trim() === hush.botName}>
          Save
        </button>
      </form>
      <p className="mb-1.5 mt-4 text-caption text-muted">Personality</p>
      {seg("tone", [["warm", "Warm"], ["playful", "Playful"], ["direct", "Direct"]])}
      <p className="mb-1.5 mt-4 text-caption text-muted">When should Hush step in?</p>
      {seg("proactivity", [["ask", "Only when asked"], ["gentle", "On its own"], ["proactive", "Proactive"]])}
      <button type="button" role="switch" aria-checked={hush.emoji} onClick={() => save({ emoji: !hush.emoji }, "Saved.")} className="mt-4 flex w-full items-center justify-between text-left">
        <span className="text-secondary font-semibold">Emoji in the group</span>
        <span className={`relative h-7 w-12 rounded-full ${hush.emoji ? "bg-[#30d158]" : "bg-hairline"}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${hush.emoji ? "left-6" : "left-1"}`} />
        </span>
      </button>
      <p className="mt-3 text-caption text-muted">
        Your own Hush (how it talks to you privately, and what it plans around) is in{" "}
        <Link href="/settings#make-hush-yours" className="font-semibold text-galaxy">Settings → Make Hush yours</Link>.
      </p>
      {msg && <p className={`mt-2 text-caption ${msg.ok ? "text-galaxy" : "text-danger"}`}>{msg.text}</p>}
    </section>
  );
}
