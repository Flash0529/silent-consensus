import { after } from "next/server";
import { db } from "@/lib/db";

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
  });
  return true;
}

// Called when a member finishes their private interview.
export async function onMemberDone(circleId: string) {
  const members = await db.member.findMany({ where: { circleId }, select: { interviewStatus: true } });
  const allDone = members.length >= 2 && members.every((m) => m.interviewStatus === "DONE");
  if (allDone) await startPipeline(circleId);
  return { allDone };
}
