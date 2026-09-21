import Link from "next/link";

export function LogoMark() {
  return (
    <span
      className="border-accent-fg/70 bg-accent/20 flex size-5 items-center justify-center rounded-[5px] border transition-transform duration-500 group-hover:rotate-90"
      aria-hidden
    >
      <span className="bg-accent-fg size-2 rotate-45" />
    </span>
  );
}

export function Logo() {
  return (
    <Link href="/" className="group text-fg flex items-center gap-2 text-[15px] font-semibold tracking-tight">
      <LogoMark />
      Lodestar
    </Link>
  );
}
