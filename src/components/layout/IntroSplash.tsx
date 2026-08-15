import Image from "next/image";

/**
 * The opening drop. Server-rendered so it is painted with the very first frame
 * — a splash mounted by client JS flashes the page first, which is worse than
 * having no splash at all.
 *
 * Everything after that is CSS: the overlay animates itself out and ends at
 * `visibility: hidden` with no pointer events, so React never has to remove it
 * and there is no hydration boundary to get wrong. Because the App Router keeps
 * the root layout mounted, this plays on a real page load and not on in-app
 * navigation.
 *
 * The inline script in layout.tsx can cut it short — in a background tab, or as
 * a failsafe — by injecting a style rule rather than touching this element or
 * any class React renders.
 */
export function IntroSplash() {
  return (
    <div id="intro-splash" aria-hidden>
      {/* The rings are siblings of the drop, not children. Nested inside it they
          were positioned against the drop's own box and inherited its fall and
          squash — so they travelled and deformed with it instead of staying put
          on the floor where it landed. */}
      <span className="intro-splash__ripple" />
      <span className="intro-splash__ripple intro-splash__ripple--late" />

      <div className="intro-splash__mark">
        <Image src="/logo-mark.png" alt="" width={256} height={256} priority />
      </div>
    </div>
  );
}
