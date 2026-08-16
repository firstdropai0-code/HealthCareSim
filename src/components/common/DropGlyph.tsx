/**
 * The bullet that opens an eyebrow label.
 *
 * Replaces a plain dot, which read as a status light or a loading spinner —
 * especially with the pulsing halo it used to carry, on labels that are not
 * live and have no status. A drop says whose product this is instead, and ties
 * the header mark into the interface at text scale.
 */
export function DropGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`h-3 w-3 shrink-0 text-[var(--color-primary)] ${className}`}
      fill="currentColor"
    >
      {/* A teardrop: point at the top, round base. Kept as one solid silhouette
          — outlines and inner highlights turn to mush at 12px. */}
      <path d="M12 2.4c.4 0 .7.2.9.5 1.3 1.9 5.6 8.3 5.6 12.1a6.5 6.5 0 0 1-13 0c0-3.8 4.3-10.2 5.6-12.1.2-.3.5-.5.9-.5Z" />
    </svg>
  );
}
