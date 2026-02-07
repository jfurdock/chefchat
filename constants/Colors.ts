const brand = {
  charcoal: '#2B2B2B',
  cream: '#F7F3EE',
  sage: '#8FAF8A',
  sageDark: '#7D9D79',
  softGray: '#6E6E6E',
  lightGray: '#E6E2DD',
  white: '#FFFFFF',
};

const Colors = {
  brand,
  light: {
    text: brand.charcoal,
    textSecondary: brand.softGray,
    background: brand.cream,
    backgroundSecondary: brand.white,
    tint: brand.sage,
    card: brand.white,
    border: brand.lightGray,
    tabIconDefault: '#A5A5A5',
    tabIconSelected: brand.sage,
  },
};

export default Colors;
