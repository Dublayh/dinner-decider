// ═══ "The House Menu" design language ════════════════════════════════════════
//
// Letterpress supper-club menu: warm paper, espresso ink, hard offset shadows,
// square "rubber stamp" chips, serif display type (Fraunces) + mono labels
// (Space Mono). Light mode = daylight paper; dark mode = candlelight.

// ─── Colour palettes ────────────────────────────────────────────────────────

export const lightColors = {
  bg:          '#F4ECDD',   // warm paper
  bgCard:      '#FCF7EC',   // lifted paper sheet
  bgMuted:     '#ECE1CB',
  bgCardAlt:   '#F6EDD9',

  // Ink — the signature. Outlines interactive elements, fills selected stamps.
  ink:       '#2C1B0B',
  stampText: '#F9F2E2',   // text printed on ink fill
  line:      '#DCCBA9',   // hairline list dividers
  shadow:    '#2C1B0B',   // hard offset shadow (letterpress plate)

  primary:      '#BC5B27',  // burnt terracotta
  primaryLight: '#F4DFC5',
  primaryDark:  '#8C3D12',
  accent:      '#5F7A4E',   // olive
  accentLight: '#E2EAD5',

  textPrimary:   '#2C1B0B',
  textSecondary: '#6E5A41',
  textMuted:     '#9C8867',
  border:       '#D9C8A9',  // soft border for inputs / quiet containers
  borderStrong: '#B39C74',
  danger:      '#A93226',
  dangerLight: '#F6E0DC',

  // Chip = stamp. Off: ink outline on paper. On: solid ink, paper text.
  chipBg:       '#FCF7EC',
  chipBorder:   '#2C1B0B',
  chipText:     '#2C1B0B',
  chipOnBg:     '#2C1B0B',
  chipOnBorder: '#2C1B0B',
  chipOnText:   '#F9F2E2',

  toggleBg:      '#FCF7EC',
  toggleBorder:  '#2C1B0B',
  toggleText:    '#2C1B0B',
  toggleOnBg:    '#2C1B0B',
  toggleOnBorder:'#2C1B0B',
  toggleOnText:  '#F9F2E2',

  sectionLabel: '#9C8867',
};

export const darkColors = {
  bg:          '#171009',   // candlelit room
  bgCard:      '#231913',
  bgMuted:     '#2E2115',
  bgCardAlt:   '#291E11',

  ink:       '#E6D2A8',   // cream ink on dark paper
  stampText: '#231507',
  line:      'rgba(230,210,168,0.18)',
  shadow:    'rgba(0,0,0,0.55)',

  primary:      '#D8863B',  // candle amber
  primaryLight: 'rgba(216,134,59,0.16)',
  primaryDark:  '#EDAF6A',
  accent:      '#8FA97C',
  accentLight: 'rgba(143,169,124,0.18)',

  textPrimary:   '#F2E7CE',
  textSecondary: 'rgba(226,203,158,0.78)',
  textMuted:     'rgba(226,203,158,0.48)',
  border:       'rgba(230,210,168,0.22)',
  borderStrong: 'rgba(230,210,168,0.42)',
  danger:      '#E05B4C',
  dangerLight: 'rgba(224,91,76,0.14)',

  chipBg:       '#231913',
  chipBorder:   '#E6D2A8',
  chipText:     '#E6D2A8',
  chipOnBg:     '#E6D2A8',
  chipOnBorder: '#E6D2A8',
  chipOnText:   '#231507',

  toggleBg:      '#231913',
  toggleBorder:  '#E6D2A8',
  toggleText:    '#E6D2A8',
  toggleOnBg:    '#E6D2A8',
  toggleOnBorder:'#E6D2A8',
  toggleOnText:  '#231507',

  sectionLabel: 'rgba(226,203,158,0.48)',
};

export type ThemeColors = typeof lightColors;
export type ThemeMode = 'light' | 'dark';

// ─── Typography ─────────────────────────────────────────────────────────────
// Custom families are static weights — never pair them with fontWeight
// (Android will fake-bold or fall back to the system font).

export const type = {
  serif:          'Fraunces_400Regular',
  serifItalic:    'Fraunces_400Regular_Italic',
  serifSemi:      'Fraunces_600SemiBold',
  serifSemiItalic:'Fraunces_600SemiBold_Italic',
  serifBold:      'Fraunces_700Bold',
  serifBlack:     'Fraunces_900Black',
  serifBlackItalic:'Fraunces_900Black_Italic',
  mono:           'SpaceMono_400Regular',
  monoBold:       'SpaceMono_700Bold',
};

// ─── Shape & scale ──────────────────────────────────────────────────────────
// The pill is dead. Corners are square-ish, like printed card stock.

export const radius = { sm: 2, md: 3, lg: 5, xl: 8, full: 999 };
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const font = { xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28, display: 42 };

// Hard offset shadow — stacked card stock. Works on Android (new arch) + web.
export const hardShadow = (color: string, size = 3) =>
  ({ boxShadow: `${size}px ${size}px 0px ${color}` });

// Pressed state for letterpress buttons: sink into the page.
export const pressedShadow = (color: string) => ({
  transform: [{ translateX: 2 }, { translateY: 2 }],
  boxShadow: `1px 1px 0px ${color}`,
});

// ─── Wheel ──────────────────────────────────────────────────────────────────
// Vintage menu-board palette: terracotta, olive, brick, mustard, slate…

export const wheelColors = [
  '#B4551F', '#6F7D46', '#9C3D2E', '#C9962E', '#4E6379',
  '#7E5233', '#587D63', '#C07248', '#7D5A70', '#3F5B52',
];

// Legacy export so existing imports of `colors` still compile
export const colors = lightColors;
