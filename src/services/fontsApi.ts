import { FALLBACK_FONT_FAMILIES } from '../data/fontFallbacks';

export interface FontOption {
  family: string;
  category: string;
  source: 'google' | 'fallback';
}

interface GoogleFontItem {
  family: string;
  category?: string;
}

interface GoogleFontsResponse {
  items?: GoogleFontItem[];
}

const GOOGLE_FONTS_API_KEY = import.meta.env.VITE_GOOGLE_FONTS_API_KEY;
const SYSTEM_FONT_FAMILIES = [
  'Georgia',
  'Times New Roman',
  'Palatino',
  'Garamond',
  'Helvetica',
  'Arial',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Gill Sans',
  'Segoe UI',
  'Courier New',
  'Lucida Console'
];

const sanitizeFontName = (fontFamily: string) =>
  fontFamily.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();

export const loadFontFamily = (fontFamily: string, allowRemoteLoad = true) => {
  if (!fontFamily) return;
  if (!allowRemoteLoad) return;

  const linkId = `font-${sanitizeFontName(fontFamily)}`;
  if (document.getElementById(linkId)) {
    return;
  }

  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily).replace(/%20/g, '+')}:wght@400;500;700&display=swap`;
  document.head.appendChild(link);
};

export const getLocalFontOptions = (): FontOption[] =>
  SYSTEM_FONT_FAMILIES.map((family) => ({
    family,
    category: 'system',
    source: 'fallback'
  }));

const getFallbackFonts = (): FontOption[] =>
  FALLBACK_FONT_FAMILIES.map((family) => ({
    family,
    category: 'fallback',
    source: 'fallback'
  }));

export const fetchFontOptions = async (): Promise<FontOption[]> => {
  if (!GOOGLE_FONTS_API_KEY) {
    return getFallbackFonts();
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONTS_API_KEY}&sort=popularity`
    );

    if (!response.ok) {
      throw new Error(`Google Fonts API failed with status ${response.status}`);
    }

    const payload = (await response.json()) as GoogleFontsResponse;
    const items = payload.items ?? [];

    if (items.length === 0) {
      return getFallbackFonts();
    }

    return items.map((item) => ({
      family: item.family,
      category: item.category ?? 'unknown',
      source: 'google'
    }));
  } catch {
    return getFallbackFonts();
  }
};
