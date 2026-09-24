"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { CAPTCHA_FAILED, verifyCaptcha } from "@/lib/captcha";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { requireUser } from "@/lib/session";
import { reviewInputSchema } from "@/lib/validators";

export type ReviewFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
  saved?: boolean;
};

/**
 * Leaves a review of a company, for a person to read before it publishes.
 *
 * Nothing here goes live on its own: the row is written PENDING and an admin
 * approves it in /admin/moderation. Editing an existing review replaces it and
 * sends it back to the queue, because the new text has not been read either.
 */
export async function submitReview(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const user = await requireUser();
  const ip = clientIp(await headers());
  if (!(await rateLimit("account", `review:${user.id}`))) {
    return { message: "Too many attempts just now. Try again in a minute." };
  }
  if (!(await verifyCaptcha(formData.get("cf-turnstile-response"), ip))) {
    return { message: CAPTCHA_FAILED };
  }

  const companyId = z
    .string()
    .regex(/^[a-z0-9]{10,40}$/i)
    .safeParse(formData.get("companyId"));
  if (!companyId.success) return { message: "We couldn't find that company." };

  const parsed = reviewInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { message: "Please fix the highlighted fields.", errors: z.flattenError(parsed.error).fieldErrors };
  }
  const values = parsed.data;

  const company = await db.company.findUnique({ where: { id: companyId.data }, select: { id: true } });
  if (!company) return { message: "We couldn't find that company." };

  await db.companyReview.upsert({
    where: { companyId_userId: { companyId: company.id, userId: user.id } },
    create: {
      companyId: company.id,
      userId: user.id,
      rating: values.rating,
      title: values.title,
      pros: values.pros,
      cons: values.cons,
      roleTitle: values.roleTitle ?? null,
      stillThere: values.stillThere,
    },
    update: {
      rating: values.rating,
      title: values.title,
      pros: values.pros,
      cons: values.cons,
      roleTitle: values.roleTitle ?? null,
      stillThere: values.stillThere,
      // Re-queued: the edited text has not been read by anyone yet.
      status: "PENDING",
      reviewNote: null,
      reviewedAt: null,
    },
  });

  // No revalidation: nothing public changed until an admin approves it.
  return { saved: true, message: "Thanks — we'll read it before it appears." };
}
