import Image from "next/image";
import { cn } from "@/lib/cn";

/** Logo when we have one, otherwise a steel tile with the initial in chrome. */
export function CompanyAvatar({
  name,
  logoUrl,
  size = "md",
}: {
  name: string;
  logoUrl?: string | null;
  size?: "md" | "lg";
}) {
  const px = size === "lg" ? 56 : 40;
  const box = cn(
    "metal flex shrink-0 items-center justify-center overflow-hidden font-semibold",
    size === "lg" ? "size-14 rounded-2xl text-xl" : "size-10 rounded-xl text-sm",
  );
  if (logoUrl) {
    return (
      <span className={box}>
        <Image src={logoUrl} alt="" width={px} height={px} className="size-full object-cover" />
      </span>
    );
  }
  return (
    <span className={box} aria-hidden>
      <span className="steel-text">{name.charAt(0).toUpperCase()}</span>
    </span>
  );
}
