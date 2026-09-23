export type TutorNoteParts = {
  wrong: string;
  right: string;
};

const WRONG = "what you got wrong";
const RIGHT = "what you got right";

function bodyAfter(text: string): string {
  return text
    .replace(/^[:\s#*-]+/, "")
    .replace(/\s*#+\s*$/, "")
    .trim();
}

/** Split a translation note into the two requested sections. */
export function splitTutorNote(reply: string): TutorNoteParts | null {
  const text = reply.replace(/\r\n/g, "\n");
  const lower = text.toLowerCase();
  const wrongAt = lower.indexOf(WRONG);
  const rightAt = lower.indexOf(RIGHT);
  if (wrongAt < 0 || rightAt < 0 || wrongAt >= rightAt) return null;
  const wrong = bodyAfter(text.slice(wrongAt + WRONG.length, rightAt));
  const right = bodyAfter(text.slice(rightAt + RIGHT.length));
  if (!wrong && !right) return null;
  return { wrong: wrong || "None.", right: right || "None." };
}
