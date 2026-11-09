import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...rest }: P) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...rest,
  };
}

export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);
export const IconStar = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? 'currentColor' : 'none'}>
    <path d="m12 3.6 2.5 5.2 5.6.8-4.1 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z" />
  </svg>
);
export const IconLeaf = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 19c0-8 5.5-13.5 15-14-0.5 9.5-6 15-14 15" />
    <path d="M5 19c3-3.5 6-6.5 10-9" />
  </svg>
);
export const IconCompass = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15.5 8.5-2 5-5 2 2-5z" />
  </svg>
);
export const IconSprout = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 20v-8" />
    <path d="M12 12c0-4 2.5-6.5 7-6.5 0 4-2.5 6.5-7 6.5Z" />
    <path d="M12 14c0-3-2-5-6-5 0 3 2 5 6 5Z" />
  </svg>
);
export const IconDrop = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5c3.5 4.2 6 7.4 6 10.5a6 6 0 0 1-12 0c0-3.1 2.5-6.3 6-10.5Z" />
  </svg>
);
export const IconLayers = (p: P) => (
  <svg {...base(p)}>
    <path d="m12 4 8.5 4.5L12 13 3.5 8.5z" />
    <path d="m3.5 13 8.5 4.5 8.5-4.5" />
  </svg>
);
export const IconGrid = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);
export const IconList = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01" />
  </svg>
);
export const IconPlay = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 5.5v13l10-6.5z" />
  </svg>
);
export const IconPause = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 5.5v13M15 5.5v13" />
  </svg>
);
export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
    <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconChevron = (p: P) => (
  <svg {...base(p)}>
    <path d="m7 10 5 5 5-5" />
  </svg>
);
export const IconBack = (p: P) => (
  <svg {...base(p)}>
    <path d="M14.5 6 8.5 12l6 6" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
  </svg>
);
export const IconWallet = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h10.5v3" />
    <rect x="4.5" y="8" width="15" height="11" rx="2.5" />
    <path d="M16 13.5h.01" />
  </svg>
);
export const IconInfo = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
