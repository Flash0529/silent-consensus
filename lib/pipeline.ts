import { after } from "next/server";
import { db } from "@/lib/db";
import { sendConversationMessage, textingEnabled } from "@/lib/twilio/client";

/**
 * Start the planner (hangout) or mediator (disagreement) once, in the background.
 * The COLLECTING → PLANNING transition is atomic, so double taps and the
 * "last person finished" trigger can't start two runs.
 */
export async function startPipeline(circleId: string, opts: { replan?: boolean } = {}) {
  const from = opts.replan ? "PROPOSED" : "COLLECTING";
  const res = await db.circle.updateMany({
    where: { id: circleId, status: from, ...(opts.replan ? { replanCount: { lt: 1 } } : {}) },
    data: {
      status: "PLANNING",
      planningStage: "READING",
      foundCount: null,
      ...(opts.replan ? { replanCount: { increment: 1 } } : {}),
    },
  });
  if (res.count !== 1) return false;
  const circle = await db.circle.findUniqueOrThrow({ where: { id: circleId }, select: { kind: true } });
  after(async () => {
    if (circle.kind === "MEDIATE") {
      const { runMediator } = await import("@/lib/ai/mediator");
      await runMediator(circleId);
    } else {
      const { runPlanner } = await import("@/lib/ai/planner");
      await runPlanner(circleId);
    }
    // Post the plan into the in-app group chat (group-safe fields, leak check passed).
    const { announcePlanInChat } = await import("@/lib/groupchat");
    await announcePlanInChat(circleId).catch((e) => console.error("announce plan in chat failed", e));
    // Post the proposed plan to the group text, if there is one. announcePlanToGroup only uses
    // toGroupSafe() output, only when the leak check passed, and only if everyone in the group
    // text has opted in to SMS.
    if (textingEnabled()) {
      const { announcePlanToGroup } = await import("@/lib/twilio/hush");
      await announcePlanToGroup(circleId).catch((e) => console.error("announce plan failed", e));
    }
  });
  return true;
}

// Called when a member finishes their private interview.
// Called when a member finishes their private interview (web chat or SMS).
export async function onMemberDone(circleId: string) {
  const circle = await db.circle.findUnique({
    where: { id: circleId },
    select: { groupConversationSid: true, smsHeldAt: true, kind: true, members: { select: { interviewStatus: true } } },
  });
  const members = circle?.members ?? [];
  const allDone = members.length >= 2 && members.every((m) => m.interviewStatus === "DONE");

  // Tell the group text, without saying anything about who said what. Skipped while the group
  // text is held (someone in it hasn't opted in to SMS).
  if (allDone && circle?.groupConversationSid && !circle.smsHeldAt && textingEnabled()) {
    const body =
      circle.kind === "MEDIATE"
        ? "Everyone's been heard privately. I'm working on a fair way forward and will share it here."
        : "Everyone's checked in privately. I'm putting together a plan that works for everyone.";
    await sendConversationMessage(circle.groupConversationSid, body).catch((e) =>
      console.error("group notify failed", e),
    );
  }
  if (allDone && circle) {
    const { announceAllCheckedIn } = await import("@/lib/groupchat");
    await announceAllCheckedIn({ id: circleId, kind: circle.kind }).catch((e) => console.error("chat notify failed", e));
  }
  if (allDone) await startPipeline(circleId);
  return { allDone };
}
