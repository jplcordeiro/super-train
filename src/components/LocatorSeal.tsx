import { cn } from "@/lib/utils";

/**
 * The app's signature mark: a território boundary rendered as a "seal" —
 * echoing TerritorioGlyph — with the live "você está aqui" GPS marker at its
 * centroid. Shared between the Login identity block and the boot splash so the
 * two frames share one mark and transition seamlessly.
 *
 * - default (`tracing=false`): the resting seal with the GPS pulse — "you are here".
 * - `tracing`: a surveyor's dash chases the boundary — "plotting the território"
 *   while the app comes online. Both share the static outline and center dot, so
 *   the boot splash settles into Login without the mark moving.
 */
export function LocatorSeal({
  className = "h-24 w-24",
  tracing = false,
}: {
  className?: string;
  tracing?: boolean;
}) {
  // Irregular plot outline; centroid of these points sits near (55, 60).
  const ring = "24,40 58,22 96,44 88,86 44,96 20,70";
  return (
    <svg
      className={cn(className)}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Selo de território com marcador de localização"
    >
      <polygon
        points={ring}
        className="fill-jwblue/10 stroke-jwblue-deep"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {tracing ? (
        /* surveyor's dash tracing the boundary — the app is plotting itself */
        <polygon
          points={ring}
          pathLength={100}
          className="seal-trace fill-none stroke-jwblue"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        /* expanding GPS pings — "você está aqui" */
        <>
          <circle cx="55" cy="60" r="18" className="locator-ping fill-jwblue/25" />
          <circle
            cx="55"
            cy="60"
            r="18"
            className="locator-ping locator-ping--lag fill-jwblue/25"
          />
        </>
      )}
      {/* the "you are here" dot — present in both states, so it never jumps */}
      <circle cx="55" cy="60" r="6.5" className="fill-white" />
      <circle cx="55" cy="60" r="4.5" className="fill-jwblue" />
    </svg>
  );
}
