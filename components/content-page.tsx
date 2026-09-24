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
    <Container className="py-16">
      <div className="max-w-2xl">
        {eyebrow && <p className="text-subtle text-[11px] font-medium tracking-[0.16em] uppercase">{eyebrow}</p>}
        <h1 className="steel-text mt-3 pb-1 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">{title}</h1>
        {intro && <p className="text-muted mt-5 text-base leading-relaxed">{intro}</p>}
        <div className="hairline my-10" aria-hidden />
        <div className="prose-job text-[15px]">{children}</div>
      </div>
    </Container>
  );
}
