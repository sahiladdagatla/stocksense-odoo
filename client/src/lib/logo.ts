/** StockSense isometric "S" mark, 64×64 viewBox. Each face is filled by a brand token. */
export type LogoPart =
  'logo-dark' | 'logo-top' | 'logo-mid' | 'logo-mid-light' | 'logo-light' | 'logo-ramp';

export const LOGO_FACES: { d: string; part: LogoPart }[] = [
  { d: 'M11.22 37.27 L39.39 51.35 L39.39 61.0 L11.22 46.92Z', part: 'logo-dark' },
  { d: 'M52.78 44.65 L39.39 51.35 L39.39 61.0 L52.78 54.3Z', part: 'logo-mid-light' },
  { d: 'M24.61 30.57 L52.78 44.65 L39.39 51.35 L11.22 37.27Z', part: 'logo-light' },
  { d: 'M36.14 28.75 L52.78 44.65 L39.39 51.35 L22.74 35.45Z', part: 'logo-ramp' },
  { d: 'M11.22 17.28 L22.74 23.04 L22.74 35.45 L11.22 29.69Z', part: 'logo-mid' },
  { d: 'M36.14 16.34 L22.74 23.04 L22.74 35.45 L36.14 28.75Z', part: 'logo-mid-light' },
  { d: 'M11.22 9.7 L39.39 23.78 L39.39 31.36 L11.22 17.28Z', part: 'logo-dark' },
  { d: 'M52.78 17.08 L39.39 23.78 L39.39 31.36 L52.78 24.66Z', part: 'logo-dark' },
  { d: 'M24.61 3.0 L52.78 17.08 L39.39 23.78 L11.22 9.7Z', part: 'logo-top' },
];

/** Fixed colours for non-CSS contexts (canvas labels). Light-surface version. */
export const LOGO_COLORS: Record<LogoPart, string> = {
  'logo-dark': '#4a2c42',
  'logo-top': '#5e3d55',
  'logo-mid': '#714b67',
  'logo-mid-light': '#9d7493',
  'logo-light': '#ecdde7',
  'logo-ramp': '#e2cbd9',
};
