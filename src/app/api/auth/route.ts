import { z } from "zod";
import { json, serverError } from "@/lib/api";
import { authClient, memorySession, requireUser, toSession } from "@/lib/auth";
import { getDb } from "@/lib/store";

const email = z.email().trim().toLowerCase().max(200);
const password = z.string().min(6).max(72);

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("signup"), email, password }),
  z.object({ action: z.literal("login"), email, password: z.string().min(1).max(72) }),
  /** Swap an expiring session for a fresh one (the phone does this by itself). */
  z.object({ action: z.literal("refresh"), refresh_token: z.string().min(1).max(500) }),
  /** "Kam harruar fjalëkalimin": email a link that opens the app to choose a new one. */
  z.object({ action: z.literal("forgot"), email }),
  /** Set a new password; needs the session from that link (sent as Authorization). */
  z.object({ action: z.literal("password"), password }),
]);

const WRONG_LOGIN = "Email-i ose fjalëkalimi është i gabuar.";

/**
 * Accounts are made on the server with the service key, already confirmed, so nobody has to wait for
 * a confirmation email (the free email quota is kept for forgotten passwords).
 */
export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "email") return json({ error: "Shkruani një email të saktë, p.sh. emri@gmail.com." }, 400);
    if (issue?.path[0] === "password") return json({ error: "Fjalëkalimi duhet të ketë të paktën 6 shkronja." }, 400);
    return json({ error: "Kërkesë e pasaktë." }, 400);
  }
  const body = parsed.data;

  if (!getDb()) {
    if (body.action === "signup" || body.action === "login") return json({ session: memorySession(body.email) });
    if (body.action === "refresh") return json({ session: memorySession("") });
    return json({ ok: true });
  }

  try {
    const auth = authClient().auth;
    switch (body.action) {
      case "signup": {
        const created = await auth.admin.createUser({ email: body.email, password: body.password, email_confirm: true });
        if (created.error) {
          if (created.error.code === "weak_password") {
            return json({ error: "Fjalëkalimi është shumë i dobët. Zgjidhni një më të gjatë." }, 400);
          }
          if (created.error.code === "email_exists" || created.error.status === 422) {
            return json({ error: "Ky email ka tashmë llogari. Shtypni „Hyr“ më poshtë." }, 409);
          }
          return serverError(created.error);
        }
        const { data, error } = await auth.signInWithPassword({ email: body.email, password: body.password });
        if (error || !data.session) return serverError(error);
        return json({ session: toSession(data.session) }, 201);
      }
      case "login": {
        const { data, error } = await auth.signInWithPassword({ email: body.email, password: body.password });
        if (data.session) return json({ session: toSession(data.session) });
        if (error?.status === 429) return json({ error: "Shumë përpjekje. Provoni pas pak minutash." }, 429);
        if (error && (error.status ?? 500) >= 500) return serverError(error);
        return json({ error: WRONG_LOGIN }, 401);
      }
      case "refresh": {
        const { data, error } = await auth.refreshSession({ refresh_token: body.refresh_token });
        if (data.session) return json({ session: toSession(data.session) });
        if (error && (error.status ?? 500) >= 500) return serverError(error);
        return json({ error: "Hyni përsëri në llogarinë tuaj." }, 401);
      }
      case "forgot": {
        const { error } = await auth.resetPasswordForEmail(body.email, { redirectTo: `${new URL(req.url).origin}/` });
        if (error?.status === 429) {
          return json({ error: "U dërguan shumë email-e. Provoni përsëri pas një ore." }, 429);
        }
        if (error) console.error("[auth] reset email", error);
        // Same answer whether or not the email has an account, so the form can't be used to find accounts.
        return json({ ok: true });
      }
      case "password": {
        const user = await requireUser(req);
        if (user instanceof Response) return user;
        const { error } = await auth.admin.updateUserById(user.userId, { password: body.password });
        if (error) return serverError(error);
        return json({ ok: true });
      }
    }
  } catch (err) {
    return serverError(err);
  }
}
