import Image from "next/image";
import { cn } from "@/lib/cn";
import { companyLogo } from "@/lib/logos";

type AvatarCompany = { name: string; slug: string; logoUrl?: string | null };

/** The company's logo tile, or its initial in chrome on a steel tile when there is no logo. */
export function CompanyAvatar({ company, size = "md" }: { company: AvatarCompany; size?: "md" | "lg" }) {
  const px = size === "lg" ? 56 : 40;
  const shape = size === "lg" ? "size-14 rounded-2xl" : "size-10 rounded-xl";
  const logo = companyLogo(company);

  if (logo) {
    return (
      <span className={cn("flex shrink-0 overflow-hidden bg-white ring-line-strong ring-1", shape)}>
        {/* Bundled tiles are already tiny WebP files; only logo URLs entered in /admin go through the optimizer. */}
        <Image
          src={logo}
          alt=""
          width={px}
          height={px}
          unoptimized={logo.startsWith("/logos/")}
          className="size-full object-cover"
        />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "metal flex shrink-0 items-center justify-center font-semibold",
        shape,
        size === "lg" ? "text-xl" : "text-sm",
      )}
      aria-hidden
    >
      <span className="steel-text">{company.name.charAt(0).toUpperCase()}</span>
    </span>
  );
}
