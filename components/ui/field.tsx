import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const inputClass =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-subtle hover:border-line-strong focus:border-subtle focus:outline-none";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-xs font-medium text-muted", className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(inputClass, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "h-auto min-h-40 py-2 leading-relaxed", className)} {...props} />;
}
