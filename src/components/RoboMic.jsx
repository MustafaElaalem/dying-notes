// The app icon's robot face, alive. Same 64-grid geometry as public/icon.svg:
// white capsule mic with two pill eyes filled in the accent blue, so they read
// as punched through. Without the tile it drops onto any accent circle (FAB,
// voice-card); with `tile` it renders the full cobalt rounded square.
// eyeScale drives the "listening" squint/bounce (0.15 waking slit .. 1.6 loud);
// omit it for the idle face, which blinks on its own via CSS.
export default function RoboMic({ size = 64, tile = false, eyeScale = null, className = "" }) {
  const mode = eyeScale == null ? "idle" : "live";
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`robomic ${mode} ${className}`.trim()}
      style={eyeScale == null ? undefined : { "--eyeh": eyeScale }}
      aria-hidden="true"
      focusable="false"
    >
      {tile && <rect width="64" height="64" rx="14" fill="var(--accent, #2B59E0)" />}
      <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
        <rect x="25" y="12" width="14" height="24" rx="7" fill="currentColor" stroke="none" />
        <path d="M19 30a13 13 0 0 0 26 0" />
        <path d="M32 43v8" />
        <path d="M25 51h14" />
      </g>
      <rect className="eye eye-l" x="28" y="19" width="3" height="7.5" rx="1.5" fill="var(--accent, #2B59E0)" />
      <rect className="eye eye-r" x="33" y="19" width="3" height="7.5" rx="1.5" fill="var(--accent, #2B59E0)" />
    </svg>
  );
}
