"use client";

import { useActionState } from "react";
import { CaptchaField } from "@/components/captcha-field";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { submitClaim, type FormState } from "./actions";

/**
 * Asks for posting access to a company. The work address is the evidence: a
 * person at the company can receive mail there, and an admin checks the domain
 * against the company's own website before approving it.
 *
 * `contactEmail` is passed in rather than read from lib/site, which reads
 * lib/env and would bring zod into this client bundle.
 */
export function ClaimForm({
  companies,
  contactEmail,
}: {
  companies: { id: string; name: string }[];
  contactEmail: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitClaim, {});
  const err = (field: string) => state.errors?.[field]?.[0];

  if (state.saved) {
    return (
      <p role="status" className="metal text-muted rounded-2xl p-6 text-sm">
        {state.message} We&rsquo;ll email you at the address you gave us. If your company isn&rsquo;t listed, write to{" "}
        <a href={`mailto:${contactEmail}`} className="text-fg underline underline-offset-4">
          {contactEmail}
        </a>{" "}
        and we&rsquo;ll add it.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && (
        <p role="alert" className="border-danger/40 text-danger rounded-lg border px-4 py-2.5 text-sm">
          {state.message}
        </p>
      )}

      <div>
        <Label htmlFor="companyId">Your company</Label>
        <Select id="companyId" name="companyId" defaultValue="" required>
          <option value="" disabled>
            Choose…
          </option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {err("companyId") ? (
          <p className="text-danger mt-1 text-xs">{err("companyId")}</p>
        ) : (
          <p className="text-subtle mt-1 text-xs">
            Not listed? Write to{" "}
            <a href={`mailto:${contactEmail}`} className="underline underline-offset-2">
              {contactEmail}
            </a>
            .
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="workEmail">Work email</Label>
        <Input id="workEmail" name="workEmail" type="email" required placeholder="you@company.com" />
        {err("workEmail") ? (
          <p className="text-danger mt-1 text-xs">{err("workEmail")}</p>
        ) : (
          <p className="text-subtle mt-1 text-xs">At your company&rsquo;s own domain, not a personal address.</p>
        )}
      </div>

      <div>
        <Label htmlFor="note">Anything else? (optional)</Label>
        <Textarea
          id="note"
          name="note"
          rows={3}
          className="min-h-24"
          placeholder="Your role, and what you're hiring for."
        />
        {err("note") && <p className="text-danger mt-1 text-xs">{err("note")}</p>}
      </div>

      <CaptchaField />

      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Request access"}
      </Button>
    </form>
  );
}
