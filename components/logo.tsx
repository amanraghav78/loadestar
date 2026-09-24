import Link from "next/link";

/** A four-point star cut from polished metal. */
export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="lodestar-chrome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#d4d4d8" />
          <stop offset="1" stopColor="#8e8e98" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="23" height="23" rx="7" fill="#15151a" stroke="rgb(255 255 255 / 0.16)" />
      <path
        d="M12 3.5c.5 4.3 2.2 6 6.5 6.5-4.3.5-6 2.2-6.5 6.5-.5-4.3-2.2-6-6.5-6.5 4.3-.5 6-2.2 6.5-6.5Z"
        transform="translate(0 2)"
        fill="url(#lodestar-chrome)"
      />
      <circle cx="18" cy="6" r="1.1" fill="#c4bcff" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="group text-fg flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
      <span className="transition-transform duration-500 group-hover:rotate-[20deg]">
        <LogoMark />
      </span>
      Lodestar
    </Link>
  );
}
