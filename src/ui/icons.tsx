// 24px stroke icons drawn in currentColor.
const Svg = ({ children, label }: { children: preact.ComponentChildren; label?: string }) => (
  <svg
    class="icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden={label ? undefined : "true"}
    aria-label={label}
    role={label ? "img" : undefined}
  >
    {children}
  </svg>
);

export function Stopwatch() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
      <circle cx="8" cy="9.5" r="5" />
      <path d="M8 9.5V7M6.5 2.5h3M8 2.5v2" stroke-linecap="round" />
    </svg>
  );
}

export const Cog = () => (
  <Svg>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Svg>
);

export const Camera = () => (
  <Svg>
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8l1.4-2h6.6l1.4 2h1.8A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
    <circle cx="12" cy="13" r="3.5" />
  </Svg>
);

export const Photos = () => (
  <Svg>
    <rect x="3" y="5" width="15" height="14" rx="2" />
    <path d="M6 3h13a2 2 0 0 1 2 2v12" />
    <circle cx="8.5" cy="10" r="1.5" />
    <path d="M18 15.5l-4-4-8 7.5" />
  </Svg>
);

export const Plus = () => (
  <Svg>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const ChevronLeft = () => (
  <Svg>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);

export const ChevronRight = () => (
  <Svg>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);

export const Share = () => (
  <Svg>
    <path d="M12 15V3M8 7l4-4 4 4" />
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </Svg>
);
