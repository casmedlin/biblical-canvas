/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PEXELS_API_KEY?: string;
  readonly VITE_GOOGLE_FONTS_API_KEY?: string;
  readonly VITE_API_BIBLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
