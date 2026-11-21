export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Leash"
    >
      <defs>
        <linearGradient id="leash-mark" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5FF0FF" />
          <stop offset="0.5" stopColor="#2E6BFF" />
          <stop offset="1" stopColor="#FFB37D" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#leash-mark)" />
      <path
        d="M10.5 8.5v8.2a5.5 5.5 0 0 0 11 0V8.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="16" cy="24" r="1.9" fill="#fff" />
    </svg>
  );
}
