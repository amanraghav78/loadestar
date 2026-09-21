import { cn } from "@/lib/cn";

export function Container({
  children,
  className,
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6", wide ? "max-w-6xl" : "max-w-4xl", className)}>
      {children}
    </div>
  );
}
