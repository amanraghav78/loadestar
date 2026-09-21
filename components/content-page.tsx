import { Container } from "@/components/ui/container";

/** Shared shell for the static text pages (about, privacy, employer info…). */
export function ContentPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Container className="py-14">
      <div className="max-w-2xl">
        {eyebrow && <p className="text-[11px] font-medium tracking-[0.14em] text-subtle uppercase">{eyebrow}</p>}
        <h1 className="metal-text mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
        {intro && <p className="mt-4 text-[15px] leading-relaxed text-muted">{intro}</p>}
        <div className="prose-job mt-10 text-[15px]">{children}</div>
      </div>
    </Container>
  );
}
