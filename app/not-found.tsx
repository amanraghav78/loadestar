import { LinkButton } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  return (
    <Container className="py-24 text-center">
      <p className="text-[11px] font-medium tracking-[0.14em] text-subtle uppercase">404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">This page isn&rsquo;t here</h1>
      <p className="mt-2 text-sm text-muted">
        The role may have been filled and taken down, or the link is mistyped.
      </p>
      <LinkButton href="/jobs" className="mt-6">
        Browse open roles
      </LinkButton>
    </Container>
  );
}
