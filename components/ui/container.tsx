import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Container({ className, wide = false, ...props }: ComponentProps<"div"> & { wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 sm:px-6", wide ? "max-w-6xl" : "max-w-4xl", className)} {...props} />;
}
