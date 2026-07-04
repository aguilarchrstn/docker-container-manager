// Recreated as a vector so it re-colors with the active theme instead of
// being a static image: the hexagon's "structural" half and the three
// outer nodes use currentColor (so it always contrasts with whatever
// background it sits on — sidebar vs. the login page), while the right
// half of the hexagon and the top node use the theme's accent color
// (--color-primary), so picking a new theme in Appearance changes the
// logo too.
export default function LogoMark({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M50 6 L12 28 L12 72 L50 94"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M50 6 L88 28 L88 72 L50 94"
        stroke="var(--color-primary)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M50 34 L50 66 M34 50 L66 50" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <rect x="18" y="42" width="16" height="16" rx="4" fill="currentColor" />
      <rect x="66" y="42" width="16" height="16" rx="4" fill="currentColor" />
      <rect x="42" y="66" width="16" height="16" rx="4" fill="currentColor" />
      <rect x="42" y="18" width="16" height="16" rx="4" fill="var(--color-primary)" />
    </svg>
  );
}
