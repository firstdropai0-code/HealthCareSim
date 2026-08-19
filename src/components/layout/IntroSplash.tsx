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
      <span className="intro-splash__ripple intro-splash__ripple--last" />

      {/* Thrown clear by the impact. Small, few, and gone quickly — this is the
          detail that reads as liquid rather than as a bouncing object. */}
      <span className="intro-splash__satellite intro-splash__satellite--a" />
      <span className="intro-splash__satellite intro-splash__satellite--b" />
      <span className="intro-splash__satellite intro-splash__satellite--c" />

      {/*
        The thing that falls is a plain teardrop, NOT the logo.

        The squash on landing is what sells the weight, and it has to be
        violent to work — but the mark is a detailed piece of artwork with two
        figures and a medical cross in it, and running it through a 1.42 x 0.6
        scale smeared all of that. It also fell stretched, so the brand was
        distorted for most of the time it was on screen.

        An abstract silhouette can deform as hard as the motion needs. The mark
        then forms out of the splash at uniform scale, and is never distorted
        at any point.

        The viewBox is cropped tight to the path so the element's box is the
        drop's visible bounds — otherwise `transform-origin: 50% 100%` pivots
        against empty space below it and the squash happens under the floor.
      */}
      <svg className="intro-splash__drop" viewBox="5.5 2.4 13 19.2" aria-hidden>
        <defs>
          <linearGradient id="intro-drop-fill" x1="0" y1="0" x2="1" y2="1">
            <stop className="intro-splash__drop-from" offset="0%" />
            <stop className="intro-splash__drop-to" offset="100%" />
          </linearGradient>
        </defs>
        <path
          fill="url(#intro-drop-fill)"
          d="M12 2.4c.4 0 .7.2.9.5 1.3 1.9 5.6 8.3 5.6 12.1a6.5 6.5 0 0 1-13 0c0-3.8 4.3-10.2 5.6-12.1.2-.3.5-.5.9-.5Z"
        />
      </svg>

      <div className="intro-splash__mark">
        <Image src="/logo-mark.png" alt="" width={256} height={256} priority />
      </div>
    </div>
  );
}
