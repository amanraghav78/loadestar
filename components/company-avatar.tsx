import Image from "next/image";
import { cn } from "@/lib/cn";

/** Logo when we have one, otherwise the letter tile from the mockup. */
export function CompanyAvatar({
  name,
  logoUrl,
  size = "md",
}: {
  name: string;
  logoUrl?: string | null;
  size?: "md" | "lg";
}) {
  const px = size === "lg" ? 48 : 32;
  const box = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-md metal-panel font-semibold text-fg",
    size === "lg" ? "size-12 text-lg" : "size-8 text-xs",
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
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
