import { json, requirePasscode } from "@/lib/api";

/** Lets the passcode screen check a code before storing it on the device. */
export async function POST(req: Request) {
  return requirePasscode(req) ?? json({ ok: true });
}
