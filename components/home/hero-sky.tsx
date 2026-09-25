/**
 * The sky behind the home page hero: a soft light that follows the pointer,
 * and a planet's horizon rising at the bottom with light breaking over its rim.
 * Decoration only, so it is all hidden from assistive tech.
 */

/** Follows the pointer across the hero (HomeEffects sets --hx, --hy and --hero-lit). */
export function HeroLight() {
  return <div className="hero-light" aria-hidden />;
}

/**
 * The planet's edge. Its top sits at the top of whatever contains it: the glow
 * rises above that line, the rim traces it, and the body below is the page's own
 * background, so the hero runs into the rest of the page without a seam.
 */
export function Horizon() {
  return (
    <div className="horizon" aria-hidden>
      <div className="horizon-bloom" />
      <div className="horizon-rim" />
      <div className="horizon-body" />
      <div className="horizon-line" />
    </div>
  );
}
