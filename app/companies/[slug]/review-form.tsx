"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { CaptchaField } from "@/components/captcha-field";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";
import type { MyReview } from "@/lib/reviews";
import { submitReview, type ReviewFormState } from "./actions";

/**
 * Writing a review of a company.
 *
 * The rating is radio buttons styled as stars: one control, keyboard-operable,
 * and it still submits with JavaScript off. `mine` is their existing review,
 * which they can edit — doing so sends it back for review.
 */
export function ReviewForm({
  companyId,
  companyName,
  mine,
}: {
  companyId: string;
  companyName: string;
  mine: MyReview | null;
}) {
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(submitReview, {});
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const err = (field: string) => state.errors?.[field]?.[0];

  if (state.saved) {
    return (
      <p role="status" className="text-muted text-sm">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="companyId" value={companyId} />

      {state.message && (
        <p role="alert" className="border-danger/40 text-danger rounded-lg border px-4 py-2.5 text-sm">
          {state.message}
        </p>
      )}

      <fieldset>
        <legend className="text-muted mb-1.5 text-xs font-medium">Your rating of {companyName}</legend>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="cursor-pointer p-0.5" title={`${value} out of 5`}>
              <input
                type="radio"
                name="rating"
                value={value}
                defaultChecked={mine?.rating === value}
                onChange={() => setRating(value)}
                className="peer sr-only"
                required
              />
              <Star
                className={`peer-focus-visible:outline-accent-fg size-6 transition-colors peer-focus-visible:outline ${
                  value <= rating ? "fill-accent-fg text-accent-fg" : "text-subtle"
                }`}
                aria-hidden
              />
              <span className="sr-only">{value} out of 5</span>
            </label>
          ))}
        </div>
        {err("rating") && <p className="text-danger mt-1 text-xs">{err("rating")}</p>}
      </fieldset>

      <div>
        <Label htmlFor="title">Sum it up</Label>
        <Input
          id="title"
          name="title"
          defaultValue={mine?.title}
          required
          maxLength={120}
          placeholder="Good engineering, slow decisions"
        />
        {err("title") && <p className="text-danger mt-1 text-xs">{err("title")}</p>}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="pros">What works</Label>
          <Textarea id="pros" name="pros" rows={5} className="min-h-32" defaultValue={mine?.pros} required />
          {err("pros") && <p className="text-danger mt-1 text-xs">{err("pros")}</p>}
        </div>
        <div>
          <Label htmlFor="cons">What doesn&rsquo;t</Label>
          <Textarea id="cons" name="cons" rows={5} className="min-h-32" defaultValue={mine?.cons} required />
          {err("cons") && <p className="text-danger mt-1 text-xs">{err("cons")}</p>}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="roleTitle">Your role there</Label>
          <Input
            id="roleTitle"
            name="roleTitle"
            defaultValue={mine?.roleTitle ?? ""}
            maxLength={80}
            placeholder="Backend engineer"
          />
          <p className="text-subtle mt-1 text-xs">Shown instead of your name. Your name is never published.</p>
        </div>
        <label className="text-muted flex items-center gap-2 self-end pb-2.5 text-sm">
          <input type="checkbox" name="stillThere" defaultChecked={mine?.stillThere} className="accent-accent size-4" />
          I still work here
        </label>
      </div>

      <CaptchaField />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : mine ? "Replace my review" : "Submit review"}
        </Button>
        <p className="text-subtle text-xs">A person reads every review before it appears.</p>
      </div>
    </form>
  );
}
