import Link from "next/link";

export function LogoMark() {
  return (
    <span className="flex size-5 items-center justify-center rounded-[5px] border border-accent-fg/70 bg-accent/20" aria-hidden>
      <span className="size-2 rotate-45 bg-accent-fg" />
    </span>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-fg">
      <LogoMark />
      Lodestar
    </Link>
  );
}
