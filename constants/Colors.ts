const brand = {
  // Core palette
  primary: '#F7F3EE',
  secondary: '#E9E4DD',
  // Secondary orange accent for surfaces and logo backplates
  accent: '#F3A55E',
  accentDark: '#D9772F',

  // Backward-compatible aliases used across the app
  darkAccent: '#2B2B2B',
  charcoal: '#2B2B2B',
  cream: '#F7F3EE',
  stone: '#E9E4DD',
  // Primary action greens
  sage: '#849764',
  sageDark: '#6F7D5A',
  softGray: 'rgba(43,43,43,0.72)',
  lightGray: '#E9E4DD',
  white: '#FFFFFF',
};

const Colors = {
  brand,
  light: {
    text: brand.charcoal,
    textSecondary: brand.softGray,
    background: brand.primary,
    backgroundSecondary: brand.secondary,
    tint: brand.sage,
    card: brand.secondary,
    border: 'rgba(43,43,43,0.12)',
    tabIconDefault: 'rgba(43,43,43,0.45)',
    tabIconSelected: brand.sageDark,
  },
};

export default Colors;
