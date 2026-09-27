import { beforeAll, describe, expect, it } from "vitest";
import { isValidTwilioSignature, twilioSignature } from "@/lib/twilio/signature";
import { cleanName, formatForSms, parseKeyword, resolveReply } from "@/lib/twilio/sms";
import { gate, rulesPass } from "@/lib/twilio/disparity";
import { decryptPhone, encryptPhone, maskPhone, normalizePhone, phoneHash } from "@/lib/phone";

describe("twilioSignature", () => {
  // The worked example from Twilio's request-validation docs.
  const url = "https://mycompany.com/myapp.php?foo=1&bar=2";
  const params = {
    CallSid: "CA1234567890ABCDE",
    Caller: "+12349013030",
    Digits: "1234",
    From: "+12349013030",
    To: "+18005551212",
  };

  it("matches Twilio's documented signature", () => {
    expect(twilioSignature("12345", url, params)).toBe("0/KCTR6DLpKmkAf8muzZqo1nDgQ=");
  });

  it("rejects a tampered body, a wrong URL, or a missing header", () => {
    const sig = twilioSignature("12345", url, params);
    expect(isValidTwilioSignature("12345", sig, url, params)).toBe(true);
    expect(isValidTwilioSignature("12345", sig, url, { ...params, Digits: "9999" })).toBe(false);
    expect(isValidTwilioSignature("12345", sig, "https://evil.example/hook", params)).toBe(false);
    expect(isValidTwilioSignature("12345", null, url, params)).toBe(false);
  });
});

describe("SMS rendering", () => {
  it("renders lettered options with a reply hint", () => {
    const text = formatForSms([
      { content: "Got it." },
      { content: "What's a comfortable spend?", options: ["Under $15", "$15 to $30", "$30 to $60"] },
    ]);
    expect(text).toBe(
      "Got it.\n\nWhat's a comfortable spend?\n\nA) Under $15\nB) $15 to $30\nC) $30 to $60\n\nReply A, B or C, or just type.",
    );
  });

  it("renders confirm chips as bullets", () => {
    const text = formatForSms([
      {
        content: "Here's what I'll plan around:\nDid I get that right?",
        chips: ["Under $15"],
        options: ["That's right", "Change something"],
      },
    ]);
    expect(text).toContain("• Under $15");
    expect(text).toContain("A) That's right\nB) Change something");
  });

  it("maps letter replies back to the option text", () => {
    const opts = ["Under $15", "$15 to $30", "That's right"];
    expect(resolveReply("a", opts)).toBe("Under $15");
    expect(resolveReply(" C) ", opts)).toBe("That's right");
    expect(resolveReply("E", opts)).toBe("E");
    expect(resolveReply("a bit under 20", opts)).toBe("a bit under 20");
    expect(resolveReply("b", null)).toBe("b");
  });
});

describe("parseKeyword", () => {
  it.each([
    ["STOP", "stop"],
    ["unsubscribe", "stop"],
    ["Start", "start"],
    ["help", "help"],
    ["MUTE", "mute"],
    ["unmute", "unmute"],
  ])("%s → %s", (text, kw) => expect(parseKeyword(text)?.kw).toBe(kw));

  it("parses JOIN with a code or a pasted link", () => {
    expect(parseKeyword("join k7m2qx9a")).toEqual({ kw: "join", arg: "k7m2qx9a" });
    expect(parseKeyword("JOIN https://qc.app/j/K7M2QX9A")).toEqual({ kw: "join", arg: "k7m2qx9a" });
  });

  it("never treats normal answers as keywords", () => {
    for (const t of ["yes", "stop by later?", "I can't start before 7", "help me pick"])
      expect(parseKeyword(t)).toBeNull();
  });
});

describe("cleanName", () => {
  it.each([
    ["maya", "Maya"],
    ["it's Priya!", "Priya"],
    ["hey, I'm jordan lee", "Jordan lee"],
    ["Call me Omar", "Omar"],
  ])("%s → %s", (t, n) => expect(cleanName(t)).toBe(n));
  it("rejects empty or junk", () => expect(cleanName("!!!")).toBeNull());
});

describe("rulesPass", () => {
  const omar = (body: string) => ({ author: "+14045550001", body });
  const maya = (body: string) => ({ author: "+14045550002", body });

  it("fires on a hedge right after a pricey suggestion", () => {
    const r = rulesPass(maya("maybe, I'll see"), [omar("Steakhouse Saturday? it's like $60 a head")]);
    expect(r.fired).toBe(true);
    expect(r.kind).toBe("budget");
  });

  it("fires on clashing times from different people", () => {
    const r = rulesPass(maya("I can only do Sunday at 2pm"), [omar("Saturday 7pm works for me")]);
    expect(r.fired).toBe(true);
    expect(r.reasons).toContain("clash");
  });

  it("treats a direct mention as an ask", () => {
    expect(rulesPass(omar("hey hush can you find something for saturday"), []).kind).toBe("asked");
  });

  it("stays quiet on ordinary chatter", () => {
    expect(rulesPass(maya("lol that's amazing"), [omar("saw the game last night?")]).fired).toBe(false);
  });
});

describe("gate", () => {
  const base = { proactiveMutedAt: null, lastDisparityAt: null, disparityDay: null, disparityCountToday: 0 };
  const now = new Date("2026-09-26T20:00:00Z");

  it("allows a first check-in", () => expect(gate(base, { asked: false, now }).ok).toBe(true));
  it("respects mute unless asked directly", () => {
    const muted = { ...base, proactiveMutedAt: now };
    expect(gate(muted, { asked: false, now }).why).toBe("muted");
    expect(gate(muted, { asked: true, now }).ok).toBe(true);
  });
  it("enforces the cooldown even when asked", () => {
    const recent = { ...base, lastDisparityAt: new Date(now.getTime() - 5 * 60_000) };
    expect(gate(recent, { asked: true, now }).why).toBe("cooldown");
  });
  it("enforces the daily cap, resetting on a new day", () => {
    const capped = { ...base, disparityDay: "2026-09-26", disparityCountToday: 3 };
    expect(gate(capped, { asked: false, now }).why).toBe("daily-cap");
    expect(gate({ ...capped, disparityDay: "2026-09-25" }, { asked: false, now }).ok).toBe(true);
  });
});

describe("phone", () => {
  beforeAll(() => {
    process.env.PHONE_ENC_KEY = "test-key-for-vitest";
  });

  it.each([
    ["(404) 555-0123", "+14045550123"],
    ["404.555.0123", "+14045550123"],
    ["+1 404 555 0123", "+14045550123"],
    ["14045550123", "+14045550123"],
  ])("normalizes %s", (raw, e164) => expect(normalizePhone(raw)).toBe(e164));

  it("rejects non-NANP numbers", () => {
    for (const raw of ["+44 20 7946 0958", "555-0123", "(104) 555-0123", "404 055 0123"])
      expect(normalizePhone(raw)).toBeNull();
  });

  it("hashes deterministically and round-trips encryption", () => {
    expect(phoneHash("+14045550123")).toBe(phoneHash("+14045550123"));
    expect(phoneHash("+14045550123")).not.toBe(phoneHash("+14045550124"));
    const enc = encryptPhone("+14045550123");
    expect(enc).not.toContain("4045550123");
    expect(decryptPhone(enc)).toBe("+14045550123");
    expect(maskPhone("+14045550123")).toBe("•••• 0123");
  });
});
