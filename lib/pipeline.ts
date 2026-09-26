import { db } from "@/lib/db";

// Called when a member finishes their private interview. When everyone in the
// circle is done, the planner (M3) or mediator (M3b) starts from here.
export async function onMemberDone(circleId: string) {
  const members = await db.member.findMany({ where: { circleId }, select: { interviewStatus: true } });
  const allDone = members.length >= 2 && members.every((m) => m.interviewStatus === "DONE");
  return { allDone };
}
