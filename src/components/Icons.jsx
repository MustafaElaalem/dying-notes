// Rounded stroke icon set on a 24px grid, matching the mockups.
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

export function Icon({ name, size = 22, className = "" }) {
  const glyphs = {
    mic: (<><rect x="9" y="2.5" width="6" height="11.5" rx="3" {...S} /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" {...S} /><path d="M12 18v3.5" {...S} /></>),
    search: (<><circle cx="11" cy="11" r="7" {...S} /><path d="M16.3 16.3 21 21" {...S} /></>),
    wave: <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" {...S} />,
    text: <path d="M5 6h14M5 12h14M5 18h9" {...S} />,
    list: (<><path d="M4 6.3l1.7 1.7L8.6 5" {...S} /><path d="M4 17.3l1.7 1.7 2.9-2.9" {...S} /><path d="M12.5 6.8H20M12.5 17.8H20" {...S} /></>),
    pin: (<><path d="M9.5 3.5h5l-.8 6.2 2.9 3H7.4l2.9-3z" {...S} /><path d="M12 12.7V20.5" {...S} /></>),
    play: <path d="M8.2 5.9v12.2c0 .8.9 1.3 1.6.9l9.5-6.1c.6-.4.6-1.4 0-1.8L9.8 5c-.7-.4-1.6.1-1.6.9z" fill="currentColor" />,
    pause: (<><rect x="7" y="5" width="3.6" height="14" rx="1.5" fill="currentColor" /><rect x="13.4" y="5" width="3.6" height="14" rx="1.5" fill="currentColor" /></>),
    x: <path d="M6 6l12 12M18 6 6 18" {...S} />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" {...S} strokeWidth={2.4} />,
    sparkle: (<><path d="M11 4l1.8 4.9 5 1.8-5 1.8L11 17.4l-1.8-4.9-5-1.8 5-1.8z" {...S} /><path d="M18.6 3.2l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" {...S} /></>),
    trash: (<><path d="M4.5 6.5h15M9.5 6.5V4.9a1.4 1.4 0 0 1 1.4-1.4h2.2a1.4 1.4 0 0 1 1.4 1.4v1.6" {...S} /><path d="M6.5 6.5l.8 12.1a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12.1" {...S} /><path d="M10 10.5v6M14 10.5v6" {...S} /></>),
    clock: (<><circle cx="12" cy="12" r="8.5" {...S} /><path d="M12 7.5V12l3 2" {...S} /></>),
    stop: <rect x="7" y="7" width="10" height="10" rx="3" fill="currentColor" />,
    chev: <path d="M9.5 5.5 16 12l-6.5 6.5" {...S} strokeWidth={2} />,
    hourglass: (<><path d="M7 3.5h10M7 20.5h10" {...S} /><path d="M8.3 3.5v2.4c0 2.5 7.4 3.7 7.4 6.1s-7.4 3.6-7.4 6.1v2.4" {...S} /></>),
    infinity: <path d="M12 12c-2-2.7-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.3 6-4Zm0 0c2-2.7 4-4 6-4a4 4 0 1 1 0 8c-2 0-4-1.3-6-4Z" {...S} />,
    skull: (<><path d="M12 3a7.6 7.6 0 0 0-7.6 7.6c0 2.6 1.4 4.5 3.1 5.5v2.4A1.5 1.5 0 0 0 9 20h6a1.5 1.5 0 0 0 1.5-1.5v-2.4c1.7-1 3.1-2.9 3.1-5.5A7.6 7.6 0 0 0 12 3Z" {...S} /><circle cx="9.2" cy="11" r="1.5" fill="currentColor" /><circle cx="14.8" cy="11" r="1.5" fill="currentColor" /><path d="M11 13.5h2l-1 1.9z" fill="currentColor" /></>),
    heart: <path d="M12 20.2C7.6 16.9 3.6 13.8 3.6 9.9 3.6 7.3 5.6 5.4 8 5.4c1.6 0 3.1.9 4 2.3.9-1.4 2.4-2.3 4-2.3 2.4 0 4.4 1.9 4.4 4.5 0 3.9-4 7-8.4 10.3Z" fill="currentColor" />,
    ghost: (<><path d="M12 3.5a7 7 0 0 1 7 7v8.2l-2.3-1.7-2.35 1.7-2.35-1.7-2.35 1.7-2.35-1.7L5 18.7v-8.2a7 7 0 0 1 7-7Z" {...S} /><circle cx="9.6" cy="11.5" r="1.15" fill="currentColor" /><circle cx="14.4" cy="11.5" r="1.15" fill="currentColor" /></>),
    gear: (<><circle cx="12" cy="12" r="3.2" {...S} /><path d="M12 2.8v2.4M12 18.8v2.4M4.3 7.5l2.1 1.2M17.6 15.3l2.1 1.2M4.3 16.5l2.1-1.2M17.6 8.7l2.1-1.2" {...S} /></>),
    sun: (<><circle cx="12" cy="12" r="4.2" {...S} /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19" {...S} /></>),
    moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" {...S} />,
    share: (<><circle cx="6" cy="12" r="2.6" {...S} /><circle cx="17.5" cy="5.8" r="2.6" {...S} /><circle cx="17.5" cy="18.2" r="2.6" {...S} /><path d="M8.4 10.7l6.7-3.9M8.4 13.3l6.7 3.9" {...S} /></>),
    plus: <path d="M12 5v14M5 12h14" {...S} strokeWidth={2.2} />
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      {glyphs[name] || null}
    </svg>
  );
}
