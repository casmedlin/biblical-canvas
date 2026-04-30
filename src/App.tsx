import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Cloud,
  Download,
  Edit3,
  Facebook,
  Instagram,
  Loader2,
  Mail,
  Music,
  Pin,
  PlusCircle,
  Quote,
  Save,
  Search,
  Share2,
  Twitter,
  Youtube
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { toPng } from 'html-to-image';
import {
  fetchBibleVersions,
  fetchVerse,
  getDefaultBibleVersions,
  type BibleVersionOption
} from './services/bibleApi';
import {
  fetchFontOptions,
  getLocalFontOptions,
  loadFontFamily,
  type FontOption
} from './services/fontsApi';
import logoImg from './assets/logo.png';
import defaultBg from './assets/default-bg.png';
import './App.css';

type TextAlign = 'left' | 'center' | 'right';
type BoxTarget = 'verse' | 'reference' | 'image' | null;
type ResizeHandle = 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface TextBoxState {
  x: number;
  y: number;
  width: number;
}

interface DesignState {
  verse: string;
  reference: string;
  versionLabel: string;
  imageUrl: string;
  fontFamily: string;
  verseFontSize: number;
  referenceFontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  textRotation: number;
  textShadow: number;
  uppercaseText: boolean;
  textColor: string;
  overlayOpacity: number;
  textAlignment: TextAlign;
  imageFit: 'cover' | 'contain';
  imageZoom: number;
  imagePositionX: number;
  imagePositionY: number;
  imageBrightness: number;
  imageContrast: number;
  imageSaturation: number;
  imageBlur: number;
  imageGrayscale: number;
  canvasWidth: number;
  canvasHeight: number;
  verseBox: TextBoxState;
  referenceBox: TextBoxState;
  showQuotes: boolean;
  showReference: boolean;
  showVersion: boolean;
}

interface SuggestedVerse {
  v: string;
}

interface PrivacyPreferences {
  allowExternalContent: boolean;
  acknowledgedAt: string;
  policyVersion: string;
}

interface PrivacyAuditEntry {
  event: 'consent-granted' | 'consent-denied';
  occurredAt: string;
  policyVersion: string;
}

const SUGGESTED_VERSES: SuggestedVerse[] = [
  { v: 'Psalm 23:1' },
  { v: 'John 3:16' },
  { v: 'Romans 8:28' },
  { v: 'Proverbs 3:5-6' },
  { v: 'Isaiah 41:10' },
  { v: 'Matthew 11:28' },
  { v: 'Joshua 1:9' },
  { v: 'Psalm 91:1-2' },
  { v: 'Philippians 4:13' },
  { v: 'Romans 12:2' },
  { v: 'Psalm 46:10' },
  { v: '2 Timothy 1:7' },
  { v: 'Hebrews 11:1' }
];

const PRIVACY_PREFS_KEY = 'scripturecanvas-privacy-v1';
const PRIVACY_AUDIT_KEY = 'scripturecanvas-privacy-audit-v1';
const PRIVACY_POLICY_VERSION = '2026-03-03';
const LOCAL_IMAGE_THEMES = [
  ['#0f2027', '#203a43', '#2c5364'],
  ['#2c3e50', '#4b79a1', '#283e51'],
  ['#614385', '#516395', '#1f1c2c'],
  ['#355c7d', '#6c5b7b', '#c06c84'],
  ['#16222a', '#3a6073', '#1d4350'],
  ['#134e5e', '#71b280', '#2c7744'],
  ['#3a1c71', '#d76d77', '#ffaf7b'],
  ['#1a2a6c', '#b21f1f', '#fdbb2d']
];

const createLocalImageDataUri = (label: string, index: number) => {
  const [start, mid, end] = LOCAL_IMAGE_THEMES[index % LOCAL_IMAGE_THEMES.length];
  const safeLabel = (label.trim() || 'ScriptureCanvas').slice(0, 48).replace(/[<>&"]/g, '');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='900' height='1400' viewBox='0 0 900 1400'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='${start}'/>
      <stop offset='50%' stop-color='${mid}'/>
      <stop offset='100%' stop-color='${end}'/>
    </linearGradient>
  </defs>
  <rect width='900' height='1400' fill='url(#g)'/>
  <circle cx='140' cy='190' r='180' fill='rgba(255,255,255,0.08)'/>
  <circle cx='790' cy='1120' r='220' fill='rgba(0,0,0,0.14)'/>
  <rect x='90' y='1010' width='720' height='150' rx='28' fill='rgba(0,0,0,0.22)'/>
  <text x='450' y='1098' fill='rgba(255,255,255,0.92)' font-size='44' font-family='Georgia, serif' text-anchor='middle'>${safeLabel}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const DESIGN_STATE_KEY = 'bible_verse_designer_current_design';

const DEFAULT_IMAGES = Array.from({ length: 8 }, (_, index) =>
  createLocalImageDataUri('Inspiration', index)
);

const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY;

const buildFallbackImageSet = (query: string) => {
  const normalized = query.trim() || 'Nature';
  return Array.from({ length: 8 }, (_, index) =>
    createLocalImageDataUri(normalized, index)
  );
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clampPercent = (value: number) => clamp(value, 0, 100);
const clampTextBoxWidth = (value: number) => clamp(value, 15, 98);
const clampCanvasDimension = (value: number) => clamp(value, 240, 6000);

const createDefaultDesign = (): DesignState => ({
  verse:
    'For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.',
  reference: 'Jeremiah 29:11',
  versionLabel: 'English Standard Version (ESV)',
  imageUrl: defaultBg,
  fontFamily: 'Georgia',
  verseFontSize: 2.5,
  referenceFontSize: 1.2,
  fontWeight: 700,
  lineHeight: 1.2,
  letterSpacing: 0,
  textRotation: 0,
  textShadow: 45,
  uppercaseText: false,
  textColor: '#ffffff',
  overlayOpacity: 0.4,
  textAlignment: 'center',
  imageFit: 'cover',
  imageZoom: 100,
  imagePositionX: 50,
  imagePositionY: 50,
  imageBrightness: 100,
  imageContrast: 100,
  imageSaturation: 100,
  imageBlur: 0,
  imageGrayscale: 0,
  canvasWidth: 1080,
  canvasHeight: 1920,
  verseBox: { x: 50, y: 45, width: 80 },
  referenceBox: { x: 50, y: 74, width: 60 },
  showQuotes: true,
  showReference: true,
  showVersion: false
});

type InteractionState =
  | {
      mode: 'drag';
      target: BoxTarget;
      startX: number;
      startY: number;
      origin: TextBoxState;
    }
  | {
      mode: 'drag-image';
      startX: number;
      startY: number;
      originX: number;
      originY: number;
    }
  | {
      mode: 'resize';
      target: BoxTarget;
      handle: ResizeHandle;
      startX: number;
      startY: number;
      origin: TextBoxState;
      originFontSize: number;
    };

const getBoxByTarget = (design: DesignState, target: BoxTarget): TextBoxState =>
  target === 'verse' ? design.verseBox : design.referenceBox;

const POPULAR_VERSION_HINTS = [
  'english standard version',
  'esv',
  'new international version',
  'niv',
  'king james',
  'kjv',
  'new living translation',
  'nlt'
];

const choosePopularVersionId = (
  versions: BibleVersionOption[],
  fallbackId: string
): string => {
  const findByHint = (hint: string) =>
    versions.find((version) => {
      const haystack = `${version.id} ${version.name}`.toLowerCase();
      return haystack.includes(hint);
    });

  for (const hint of POPULAR_VERSION_HINTS) {
    const matched = findByHint(hint);
    if (matched) {
      return matched.id;
    }
  }

  return versions.find((version) => version.id === fallbackId)?.id ?? versions[0]?.id ?? fallbackId;
};

const setBoxByTarget = (
  design: DesignState,
  target: BoxTarget,
  box: TextBoxState
): DesignState =>
  target === 'verse' ? { ...design, verseBox: box } : { ...design, referenceBox: box };

function App() {
  const [design, setDesign] = useState<DesignState>(() => {
    try {
      const saved = localStorage.getItem(DESIGN_STATE_KEY);
      if (saved) {
        return { ...createDefaultDesign(), ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return createDefaultDesign();
  });
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const [searchQuery, setSearchQuery] = useState('Nature');
  const [searchResults, setSearchResults] = useState<string[]>(DEFAULT_IMAGES);
  const [bibleReference, setBibleReference] = useState('Jeremiah 29:11');
  const [bibleVersions, setBibleVersions] = useState<BibleVersionOption[]>(() =>
    getDefaultBibleVersions()
  );
  const [selectedBibleVersionId, setSelectedBibleVersionId] = useState('esv');
  const [fontOptions, setFontOptions] = useState<FontOption[]>([]);
  const [selectedBox, setSelectedBox] = useState<BoxTarget>('verse');
  const [isLoadingVerse, setIsLoadingVerse] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(true);
  const [isLoadingFonts, setIsLoadingFonts] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [privacyPrefs, setPrivacyPrefs] = useState<PrivacyPreferences | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const previewAreaRef = useRef<HTMLElement>(null);
  const allowExternalContent = privacyPrefs?.allowExternalContent ?? false;

  const activeVersion = useMemo(
    () =>
      bibleVersions.find((version) => version.id === selectedBibleVersionId) ?? bibleVersions[0],
    [bibleVersions, selectedBibleVersionId]
  );

  useEffect(() => {
    localStorage.setItem(DESIGN_STATE_KEY, JSON.stringify(design));
  }, [design]);

  // Google Analytics dynamic loading
  useEffect(() => {
    const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;
    if (allowExternalContent && GA_ID) {
      // Create script tags for Google Analytics
      const script1 = document.createElement('script');
      script1.async = true;
      script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
      
      const script2 = document.createElement('script');
      script2.innerHTML = `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${GA_ID}', { 'anonymize_ip': true });
      `;
      
      document.head.appendChild(script1);
      document.head.appendChild(script2);
      
      console.log('Google Analytics initialized.');

      return () => {
        // Optional: Cleanup scripts if consent is withdrawn
        if (document.head.contains(script1)) document.head.removeChild(script1);
        if (document.head.contains(script2)) document.head.removeChild(script2);
      };
    }
  }, [allowExternalContent]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRIVACY_PREFS_KEY);
      if (!raw) {
        setPrivacyPrefs(null);
        return;
      }

      const parsed = JSON.parse(raw) as PrivacyPreferences;
      if (typeof parsed.allowExternalContent !== 'boolean') {
        setPrivacyPrefs(null);
        return;
      }

      setPrivacyPrefs(parsed);
    } catch {
      setPrivacyPrefs(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadOptions = async () => {
      try {
        if (!allowExternalContent) {
          const localFonts = getLocalFontOptions();
          if (!mounted) return;
          setFontOptions(localFonts);
          setBibleVersions(getDefaultBibleVersions());
          setSelectedBibleVersionId((current) =>
            choosePopularVersionId(getDefaultBibleVersions(), current || 'web')
          );
          setDesign((prev) => ({
            ...prev,
            fontFamily: localFonts.some((font) => font.family === prev.fontFamily)
              ? prev.fontFamily
              : localFonts[0].family,
            imageUrl: prev.imageUrl.startsWith('data:image') || prev.imageUrl.includes('pexels.com') || prev.imageUrl.includes('unsplash.com') ? prev.imageUrl : DEFAULT_IMAGES[0]
          }));
          return;
        }

        const [loadedFonts, loadedVersions] = await Promise.all([
          fetchFontOptions(),
          fetchBibleVersions()
        ]);

        if (!mounted) {
          return;
        }

        setFontOptions(loadedFonts);
        setBibleVersions(loadedVersions);
        setSelectedBibleVersionId((current) => {
          if (loadedVersions.some((version) => version.id === current)) {
            return current;
          }
          return choosePopularVersionId(loadedVersions, 'web');
        });

        if (loadedFonts.length > 0) {
          loadFontFamily(loadedFonts[0].family, true);
          setDesign((prev) => ({
            ...prev,
            fontFamily: loadedFonts.some((font) => font.family === prev.fontFamily)
              ? prev.fontFamily
              : loadedFonts[0].family
          }));
        }
      } finally {
        if (mounted) {
          setIsLoadingFonts(false);
          setIsLoadingVersions(false);
        }
      }
    };

    setIsLoadingFonts(true);
    setIsLoadingVersions(true);
    void loadOptions();

    return () => {
      mounted = false;
    };
  }, [allowExternalContent]);

  useEffect(() => {
    loadFontFamily(design.fontFamily, allowExternalContent);
  }, [design.fontFamily, allowExternalContent]);

  useEffect(() => {
    if (!activeVersion) {
      return;
    }

    setDesign((prev) => ({ ...prev, versionLabel: activeVersion.name }));
  }, [activeVersion]);

  const updateDesign = <K extends keyof DesignState>(key: K, value: DesignState[K]) => {
    setDesign((prev) => ({ ...prev, [key]: value }));
  };

  const savePrivacyPreferences = (allow: boolean) => {
    const next: PrivacyPreferences = {
      allowExternalContent: allow,
      acknowledgedAt: new Date().toISOString(),
      policyVersion: PRIVACY_POLICY_VERSION
    };
    setPrivacyPrefs(next);
    localStorage.setItem(PRIVACY_PREFS_KEY, JSON.stringify(next));

    const nextAuditEntry: PrivacyAuditEntry = {
      event: allow ? 'consent-granted' : 'consent-denied',
      occurredAt: next.acknowledgedAt,
      policyVersion: PRIVACY_POLICY_VERSION
    };
    try {
      const existingRaw = localStorage.getItem(PRIVACY_AUDIT_KEY);
      const existing = existingRaw ? (JSON.parse(existingRaw) as PrivacyAuditEntry[]) : [];
      const trimmed = [...existing, nextAuditEntry].slice(-25);
      localStorage.setItem(PRIVACY_AUDIT_KEY, JSON.stringify(trimmed));
    } catch {
      localStorage.setItem(PRIVACY_AUDIT_KEY, JSON.stringify([nextAuditEntry]));
    }

    if (!allow) {
      setStatusMessage(
        'External services are disabled. Enable them in Privacy & Legal to use remote fonts and image search.'
      );
      setSearchResults(buildFallbackImageSet(searchQuery));
    } else {
      setStatusMessage('');
    }
  };

  const reopenPrivacyChoices = () => {
    localStorage.removeItem(PRIVACY_PREFS_KEY);
    setPrivacyPrefs(null);
  };

  const fetchBibleVerse = async (reference: string = bibleReference, versionId?: string) => {
    const version =
      bibleVersions.find((item) => item.id === (versionId ?? selectedBibleVersionId)) ??
      activeVersion;

    if (!version) {
      setStatusMessage('No Bible versions are available right now.');
      return;
    }

    setIsLoadingVerse(true);
    setStatusMessage('');

    try {
      const verse = await fetchVerse(reference, version);
      setDesign((prev) => ({
        ...prev,
        verse: verse.text,
        reference: verse.reference,
        versionLabel: verse.versionLabel
      }));
      setBibleReference(reference);
    } catch {
      setStatusMessage('Verse not found. Use a format like John 3:16.');
    } finally {
      setIsLoadingVerse(false);
    }
  };

  const handleShareWithDeveloper = async () => {
    if (!canvasRef.current) return;

    const previousSelection = selectedBox;
    setSelectedBox(null);
    setIsLoadingVerse(true);
    setStatusMessage('Uploading design to server...');

    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const scaleX = design.canvasWidth / canvasRef.current.clientWidth;
      const scaleY = design.canvasHeight / canvasRef.current.clientHeight;
      const pixelRatio = Math.max(1, Math.min(2, Math.max(scaleX, scaleY)));

      const dataUrl = await toPng(canvasRef.current, { cacheBust: true, pixelRatio });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `design-${Date.now()}.png`, { type: 'image/png' });

      // Upload to server
      const formData = new FormData();
      formData.append('image', file);
      formData.append('config', JSON.stringify(design));

      // Use current origin to support single-port deployment (Docker/TrueNAS)
      const apiUrl = `${window.location.origin}/share`;
      const shareResponse = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      });

      if (!shareResponse.ok) {
        throw new Error('Server upload failed');
      }

      const result = await shareResponse.json();
      const sharedUrl = result.url;

      // Open email client with link
      const subject = encodeURIComponent(`Biblical Canvas Design: ${design.reference}`);
      const body = encodeURIComponent(
        `Check out my Biblical Canvas creation!\n\nView Design: ${sharedUrl}\n\n"${design.verse}"\n- ${design.reference} (${design.versionLabel})`
      );
      
      window.location.href = `mailto:casmedlin@wbem.org?subject=${subject}&body=${body}`;
      setStatusMessage('Design saved to server! Opening email draft with the link.');

    } catch (error) {
      console.error('Sharing failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setStatusMessage(`Unable to upload design (${errorMessage}). Is the share server running?`);
    } finally {
      setIsLoadingVerse(false);
      setSelectedBox(previousSelection);
    }
  };

  const handleNativeShare = async () => {
    if (!canvasRef.current) return;

    const previousSelection = selectedBox;
    setSelectedBox(null);
    setIsLoadingVerse(true);
    setStatusMessage('Preparing to share...');

    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const scaleX = design.canvasWidth / canvasRef.current.clientWidth;
      const scaleY = design.canvasHeight / canvasRef.current.clientHeight;
      const pixelRatio = Math.max(1, Math.min(2, Math.max(scaleX, scaleY)));

      const dataUrl = await toPng(canvasRef.current, { cacheBust: true, pixelRatio });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `biblical-canvas-${Date.now()}.png`, { type: 'image/png' });

      const shareText = `"${design.verse}"\n- ${design.reference} (${design.versionLabel})\n\nDesigned on Biblical Canvas.`;

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Biblical Canvas Design',
          text: shareText
        });
      } else {
        // Fallback for browsers that don't support file sharing
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `biblical-canvas-${Date.now()}.png`;
        link.click();
        setStatusMessage('Native sharing not supported. Image downloaded instead.');
      }
    } catch (error) {
      console.error('Sharing failed:', error);
      setStatusMessage('Unable to open share menu.');
    } finally {
      setIsLoadingVerse(false);
      setSelectedBox(previousSelection);
    }
  };

  const handleSaveAsImage = async () => {
    if (!canvasRef.current) {
      return;
    }

    const previousSelection = selectedBox;
    setSelectedBox(null);
    setStatusMessage('Generating high-quality image...');

    // Wait for the UI to update and remove the selected class/transitions
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      // Use target dimensions for the scale calculation
      const scale = design.canvasWidth / canvasRef.current.clientWidth;

      const canvas = await html2canvas(canvasRef.current, {
        useCORS: true,
        scale: scale,
        backgroundColor: null,
        logging: false,
        width: design.canvasWidth,
        height: design.canvasHeight,
      });

      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `biblical-canvas-${design.canvasWidth}x${design.canvasHeight}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      setStatusMessage('Image downloaded successfully!');
    } catch (error) {
      console.error('Save failed:', error);
      setStatusMessage('Unable to generate image. There might be a cross-origin issue with the background.');
    } finally {
      setSelectedBox(previousSelection);
    }
  };

  const handleSearch = async () => {
    setIsLoadingImages(true);
    setStatusMessage('');

    if (!allowExternalContent) {
      setSearchResults(buildFallbackImageSet(searchQuery));
      setIsLoadingImages(false);
      setStatusMessage('Enable external services to search Pexels. Showing local backgrounds.');
      return;
    }

    if (!PEXELS_API_KEY) {
      setSearchResults(buildFallbackImageSet(searchQuery));
      setIsLoadingImages(false);
      setStatusMessage('Pexels key missing. Showing local background feed.');
      return;
    }

    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=12&orientation=portrait`,
        {
          headers: {
            Authorization: PEXELS_API_KEY
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Pexels search failed with status ${response.status}`);
      }

      interface PexelsImage {
        src?: { large?: string; medium?: string; original?: string };
      }

      interface PexelsSearchResponse {
        photos?: PexelsImage[];
      }

      const payload = (await response.json()) as PexelsSearchResponse;
      const urls = (payload.photos ?? [])
        .map((photo) => photo.src?.large ?? photo.src?.medium ?? photo.src?.original)
        .filter((url): url is string => Boolean(url));

      setSearchResults(urls.length > 0 ? urls : buildFallbackImageSet(searchQuery));
    } catch {
      setSearchResults(buildFallbackImageSet(searchQuery));
      setStatusMessage('Could not reach Pexels. Showing local background feed.');
    } finally {
      setIsLoadingImages(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const nextValue = loadEvent.target?.result;
      if (typeof nextValue === 'string') {
        setDesign((prev) => ({ ...prev, imageUrl: nextValue }));
      }
    };
    reader.readAsDataURL(file);
  };

  const isDeletionOnlyChange = (previousValue: string, nextValue: string) =>
    nextValue.length <= previousValue.length;

  const handleDeleteOnlyKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const allowedKeys = new Set([
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'Tab',
      'Escape'
    ]);

    if (allowedKeys.has(event.key)) {
      return;
    }

    if (event.key.length === 1 || event.key === 'Enter') {
      event.preventDefault();
    }
  };

  const startDrag = (target: BoxTarget, clientX: number, clientY: number) => {
    setSelectedBox(target);
    setInteraction({
      mode: 'drag',
      target,
      startX: clientX,
      startY: clientY,
      origin: getBoxByTarget(design, target!)
    });
  };

  const startImageDrag = (clientX: number, clientY: number) => {
    setSelectedBox('image');
    setInteraction({
      mode: 'drag-image',
      startX: clientX,
      startY: clientY,
      originX: design.imagePositionX,
      originY: design.imagePositionY
    });
  };

  const resetTextTransform = () => {
    setDesign((prev) => ({
      ...prev,
      verseBox: { x: 50, y: 45, width: 80 },
      referenceBox: { x: 50, y: 74, width: 60 },
      textRotation: 0
    }));
  };

  const resetImageAdjustments = () => {
    setDesign((prev) => ({
      ...prev,
      imageFit: 'cover',
      imageZoom: 100,
      imagePositionX: 50,
      imagePositionY: 50,
      imageBrightness: 100,
      imageContrast: 100,
      imageSaturation: 100,
      imageBlur: 0,
      imageGrayscale: 0
    }));
  };

  const resetAllToDefault = () => {
    const defaults = createDefaultDesign();
    setDesign(defaults);
    setBibleReference(defaults.reference);
    setSearchQuery('Nature');
    setSearchResults(DEFAULT_IMAGES);
    setSelectedBox('verse');
    setInteraction(null);
    setSelectedBibleVersionId(choosePopularVersionId(bibleVersions, 'web'));
    setStatusMessage('All settings reset to default.');
  };

  useEffect(() => {
    if (!interaction || !canvasRef.current) {
      return;
    }

    const handleMove = (clientX: number, clientY: number) => {
      if (!canvasRef.current) {
        return;
      }

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const dxPercent = ((clientX - interaction.startX) / canvasRect.width) * 100;
      const dyPercent = ((clientY - interaction.startY) / canvasRect.height) * 100;

      setDesign((prev) => {
        if (interaction.mode === 'drag-image') {
          return {
            ...prev,
            imagePositionX: clampPercent(interaction.originX - dxPercent),
            imagePositionY: clampPercent(interaction.originY - dyPercent)
          };
        }

        const origin = interaction.origin;

        if (interaction.mode === 'drag') {
          let nextX = clampPercent(origin.x + dxPercent);
          let nextY = clampPercent(origin.y + dyPercent);

          const snapThreshold = 1.5;
          const snapPoints = [25, 50, 75];
          snapPoints.forEach((snap) => {
            if (Math.abs(nextX - snap) < snapThreshold) nextX = snap;
            if (Math.abs(nextY - snap) < snapThreshold) nextY = snap;
          });

          const movedBox: TextBoxState = {
            x: nextX,
            y: nextY,
            width: origin.width
          };
          return setBoxByTarget(prev, interaction.target!, movedBox);
        }

        let nextX = origin.x;
        let nextY = origin.y;
        let nextWidth = origin.width;

        if (interaction.handle === 'left' || interaction.handle === 'top-left' || interaction.handle === 'bottom-left') {
          nextWidth = clampTextBoxWidth(origin.width - dxPercent);
          nextX = clampPercent(origin.x + dxPercent / 2);
        }

        if (interaction.handle === 'right' || interaction.handle === 'bottom-right' || interaction.handle === 'top-right') {
          nextWidth = clampTextBoxWidth(origin.width + dxPercent);
          nextX = clampPercent(origin.x + dxPercent / 2);
        }

        if (interaction.handle === 'top' || interaction.handle === 'top-left' || interaction.handle === 'top-right') {
          nextY = clampPercent(origin.y + dyPercent);
        }

        if (interaction.handle === 'bottom' || interaction.handle === 'bottom-right' || interaction.handle === 'bottom-left') {
          nextY = clampPercent(origin.y + dyPercent);
        }

        const resizedBox: TextBoxState = {
          x: nextX,
          y: nextY,
          width: nextWidth
        };

        if (interaction.target === 'image') {
          const isCorner = interaction.handle === 'bottom-right' || interaction.handle === 'top-left' || interaction.handle === 'top-right' || interaction.handle === 'bottom-left';
          if (isCorner) {
            let growth = 0;
            if (interaction.handle === 'bottom-right') growth = (dxPercent + dyPercent) / 2;
            if (interaction.handle === 'top-left') growth = (-dxPercent - dyPercent) / 2;
            if (interaction.handle === 'top-right') growth = (dxPercent - dyPercent) / 2;
            if (interaction.handle === 'bottom-left') growth = (-dxPercent + dyPercent) / 2;

            return {
              ...prev,
              imageZoom: clamp(interaction.originFontSize + growth, 20, 500) // Reusing originFontSize for zoom
            };
          }
          return prev;
        }

        let nextDesign = setBoxByTarget(prev, interaction.target!, resizedBox);


        const isCorner = interaction.handle === 'bottom-right' || interaction.handle === 'top-left' || interaction.handle === 'top-right' || interaction.handle === 'bottom-left';

        if (isCorner) {
          let growth = 0;
          if (interaction.handle === 'bottom-right') growth = (dxPercent + dyPercent) / 40;
          if (interaction.handle === 'top-left') growth = (-dxPercent - dyPercent) / 40;
          if (interaction.handle === 'top-right') growth = (dxPercent - dyPercent) / 40;
          if (interaction.handle === 'bottom-left') growth = (-dxPercent + dyPercent) / 40;

          const nextSize = clamp(interaction.originFontSize + growth, 0.8, 10);
          nextDesign =
            interaction.target === 'verse'
              ? { ...nextDesign, verseFontSize: nextSize }
              : { ...nextDesign, referenceFontSize: clamp(nextSize, 0.6, 6) };
        }

        return nextDesign;
      });
    };

    const onMouseMove = (event: MouseEvent) => handleMove(event.clientX, event.clientY);
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) {
        handleMove(touch.clientX, touch.clientY);
      }
    };

    const stopInteraction = () => setInteraction(null);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopInteraction);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', stopInteraction);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopInteraction);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', stopInteraction);
    };
  }, [interaction]);

  const attributionParts: string[] = [];
  if (design.showReference && design.reference.trim()) {
    attributionParts.push(design.reference.trim());
  }
  if (design.showVersion && design.versionLabel.trim()) {
    attributionParts.push(design.versionLabel.trim());
  }

  const showReferenceBox = attributionParts.length > 0;

  useEffect(() => {
    const updateFitZoom = () => {
      const container = previewAreaRef.current;
      if (!container) {
        return;
      }

      const bounds = container.getBoundingClientRect();
      const paddingX = 48;
      const paddingY = 48;
      const availableWidth = Math.max(1, bounds.width - paddingX);
      const availableHeight = Math.max(1, bounds.height - paddingY);
      const scaleX = availableWidth / design.canvasWidth;
      const scaleY = availableHeight / design.canvasHeight;
      const nextZoom = clamp(Math.min(scaleX, scaleY), 0.05, 8);
      setPreviewZoom(nextZoom);
    };

    updateFitZoom();
    window.addEventListener('resize', updateFitZoom);
    const observer = new ResizeObserver(updateFitZoom);
    if (previewAreaRef.current) {
      observer.observe(previewAreaRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateFitZoom);
      observer.disconnect();
    };
  }, [design.canvasWidth, design.canvasHeight]);

  const textInstruction = showReferenceBox
    ? 'Drag verse or reference independently. Each has 8 resize controls.'
    : 'Drag verse independently. Each text box has 8 resize controls.';
  const showPrivacyBanner = privacyPrefs === null;

  return (
    <div className="designer-container">
      <aside className={`sidebar ${isSidebarExpanded ? 'expanded' : ''}`}>
        <button
          type="button"
          className="sidebar-header"
          aria-expanded={isSidebarExpanded}
          aria-label="Toggle settings panel"
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
        >
          <div className="mobile-toggle-hint" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={logoImg} alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '8px' }} />
            <h1>Biblical Canvas</h1>
          </div>
          <div className="mobile-only" style={{ color: 'var(--text-dim)', display: 'none' }}>
            {isSidebarExpanded ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
          </div>
        </button>

        <div className="sidebar-content">
          <div className="control-group">
            <label className="control-label">Bible Lookup</label>
            <p className="tiny-note">
              {isLoadingVersions
                ? 'Loading Bible versions...'
                : `${bibleVersions.length} Bible versions available`}
            </p>
            <p className="tiny-note">
              Verse lookup uses third-party APIs and sends your IP address and verse query to those providers.
            </p>
            <div className="quick-verse-row">
              {SUGGESTED_VERSES.map((item) => (
                <button
                  key={item.v}
                  type="button"
                  className="quick-chip"
                  onClick={() => {
                    setBibleReference(item.v);
                    void fetchBibleVerse(item.v, selectedBibleVersionId);
                  }}
                >
                  {item.v}
                </button>
              ))}
            </div>

            <div className="lookup-row">
              <input
                className="input-field"
                placeholder="Reference (e.g. John 3:16)"
                value={bibleReference}
                onChange={(event) => setBibleReference(event.target.value)}
                style={{ marginBottom: 0 }}
              />
              <select
                className="input-field"
                value={selectedBibleVersionId}
                onChange={(event) => setSelectedBibleVersionId(event.target.value)}
                style={{ width: '40%', marginBottom: 0, fontSize: '0.8rem' }}
              >
                {bibleVersions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => void fetchBibleVerse()}
              className="btn-primary"
              disabled={isLoadingVerse || !activeVersion}
            >
              {isLoadingVerse ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <BookOpen size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              )}
              Fetch Verse
            </button>
          </div>

          <div className="control-group">
            <label className="control-label">
              <Edit3 size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              Freestyle Edit
            </label>
            <p className="tiny-note">Delete-only mode: removing text is allowed, adding text is blocked.</p>
            <textarea
              className="input-field"
              placeholder="Enter your custom text here..."
              value={design.verse}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (isDeletionOnlyChange(design.verse, nextValue)) {
                  updateDesign('verse', nextValue);
                }
              }}
              onKeyDown={handleDeleteOnlyKeyDown}
              onPaste={(event) => event.preventDefault()}
              onDrop={(event) => event.preventDefault()}
              rows={3}
              style={{ marginBottom: '8px', resize: 'vertical' }}
            />
            <input
              className="input-field"
              placeholder="Reference (e.g. Jeremiah 29:11)"
              value={design.reference}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (isDeletionOnlyChange(design.reference, nextValue)) {
                  updateDesign('reference', nextValue);
                }
              }}
              onKeyDown={handleDeleteOnlyKeyDown}
              onPaste={(event) => event.preventDefault()}
              onDrop={(event) => event.preventDefault()}
            />
          </div>

          <div className="control-group">
            <label className="control-label">Text Style</label>
            <button
              type="button"
              className={`input-field ${design.showQuotes ? 'active' : ''}`}
              onClick={() => updateDesign('showQuotes', !design.showQuotes)}
              style={{
                width: '100%',
                padding: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Quote size={18} />
              {design.showQuotes ? 'Quotes On' : 'Quotes Off'}
            </button>
            <div className="toggle-row">
              <label className="toggle-option">
                <input
                  type="checkbox"
                  checked={design.showReference}
                  onChange={(event) => updateDesign('showReference', event.target.checked)}
                />
                Show reference
              </label>
              <label className="toggle-option">
                <input
                  type="checkbox"
                  checked={design.showVersion}
                  onChange={(event) => updateDesign('showVersion', event.target.checked)}
                />
                Show version
              </label>
            </div>
          </div>

          <div className="control-group">
            <label className="control-label">Typography</label>
            <p className="tiny-note">
              {isLoadingFonts
                ? 'Loading fonts...'
                : `${fontOptions.length} fonts loaded${fontOptions[0]?.source === 'fallback' ? ' (fallback dataset)' : ''}`}
            </p>
            <select
              className="input-field"
              value={design.fontFamily}
              onChange={(event) => updateDesign('fontFamily', event.target.value)}
            >
              {fontOptions.map((font) => (
                <option key={font.family} value={font.family}>
                  {font.family}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label className="tiny-note">Verse size: {design.verseFontSize.toFixed(1)}rem</label>
                <input
                  type="range"
                  min="1"
                  max="6"
                  step="0.1"
                  value={design.verseFontSize}
                  onChange={(event) => updateDesign('verseFontSize', Number(event.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="tiny-note">Reference size: {design.referenceFontSize.toFixed(1)}rem</label>
                <input
                  type="range"
                  min="0.8"
                  max="3"
                  step="0.1"
                  value={design.referenceFontSize}
                  onChange={(event) => updateDesign('referenceFontSize', Number(event.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <label className="tiny-note" style={{ display: 'block', marginBottom: '6px' }}>
                Font weight: {design.fontWeight}
              </label>
              <input
                type="range"
                min="300"
                max="900"
                step="100"
                value={design.fontWeight}
                onChange={(event) => updateDesign('fontWeight', Number(event.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginTop: '8px' }}>
              <label className="tiny-note" style={{ display: 'block', marginBottom: '6px' }}>
                Line height: {design.lineHeight.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.9"
                max="2"
                step="0.1"
                value={design.lineHeight}
                onChange={(event) => updateDesign('lineHeight', Number(event.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginTop: '8px' }}>
              <label className="tiny-note" style={{ display: 'block', marginBottom: '6px' }}>
                Letter spacing: {design.letterSpacing.toFixed(1)}px
              </label>
              <input
                type="range"
                min="-1"
                max="8"
                step="0.1"
                value={design.letterSpacing}
                onChange={(event) => updateDesign('letterSpacing', Number(event.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <label className="toggle-option" style={{ marginTop: '8px' }}>
              <input
                type="checkbox"
                checked={design.uppercaseText}
                onChange={(event) => updateDesign('uppercaseText', event.target.checked)}
              />
              Uppercase verse text
            </label>
          </div>

          <div className="control-group">
            <label className="control-label">Layout & Color</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                type="button"
                className={`input-field ${design.textAlignment === 'left' ? 'active' : ''}`}
                onClick={() => updateDesign('textAlignment', 'left')}
                style={{ padding: '8px', cursor: 'pointer' }}
              >
                <AlignLeft size={18} />
              </button>
              <button
                type="button"
                className={`input-field ${design.textAlignment === 'center' ? 'active' : ''}`}
                onClick={() => updateDesign('textAlignment', 'center')}
                style={{ padding: '8px', cursor: 'pointer' }}
              >
                <AlignCenter size={18} />
              </button>
              <button
                type="button"
                className={`input-field ${design.textAlignment === 'right' ? 'active' : ''}`}
                onClick={() => updateDesign('textAlignment', 'right')}
                style={{ padding: '8px', cursor: 'pointer' }}
              >
                <AlignRight size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="color"
                value={design.textColor}
                onChange={(event) => updateDesign('textColor', event.target.value)}
                style={{
                  width: '40px',
                  height: '40px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer'
                }}
              />
              <label style={{ fontSize: '0.85rem' }}>Text Color</label>
            </div>
            <div style={{ marginTop: '10px' }}>
              <label className="tiny-note" style={{ display: 'block', marginBottom: '6px' }}>
                Text rotation: {design.textRotation} deg
              </label>
              <input
                type="range"
                min="-45"
                max="45"
                step="1"
                value={design.textRotation}
                onChange={(event) => updateDesign('textRotation', clamp(Number(event.target.value), -45, 45))}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginTop: '10px' }}>
              <label className="tiny-note" style={{ display: 'block', marginBottom: '6px' }}>
                Text shadow: {design.textShadow}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={design.textShadow}
                onChange={(event) => updateDesign('textShadow', Number(event.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: '10px' }}
              onClick={resetTextTransform}
            >
              Reset text box transform
            </button>
            <div style={{ marginTop: '10px' }}>
              <label className="tiny-note">Active text box</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className={`btn-secondary ${selectedBox === 'verse' ? 'active-preset' : ''}`}
                  onClick={() => setSelectedBox('verse')}
                >
                  Verse
                </button>
                <button
                  type="button"
                  className={`btn-secondary ${selectedBox === 'reference' ? 'active-preset' : ''}`}
                  onClick={() => setSelectedBox('reference')}
                >
                  Reference
                </button>
                <button
                  type="button"
                  className={`btn-secondary ${selectedBox === 'image' ? 'active-preset' : ''}`}
                  onClick={() => setSelectedBox('image')}
                >
                  Image
                </button>
                </div>
                </div>
                </div>
          <div className="control-group">
            <label className="control-label">Canvas Size</label>
            <div className="size-row">
              <div>
                <label className="tiny-note">Width (px)</label>
                <input
                  className="input-field"
                  type="number"
                  min={240}
                  max={6000}
                  value={design.canvasWidth}
                  onChange={(event) =>
                    updateDesign('canvasWidth', clampCanvasDimension(Number(event.target.value) || 1080))
                  }
                />
              </div>
              <div>
                <label className="tiny-note">Height (px)</label>
                <input
                  className="input-field"
                  type="number"
                  min={240}
                  max={6000}
                  value={design.canvasHeight}
                  onChange={(event) =>
                    updateDesign('canvasHeight', clampCanvasDimension(Number(event.target.value) || 1920))
                  }
                />
              </div>
            </div>
            <div className="preset-row">
              <button type="button" className="quick-chip" onClick={() => setDesign((p) => ({ ...p, canvasWidth: 1080, canvasHeight: 1920 }))}>Story</button>
              <button type="button" className="quick-chip" onClick={() => setDesign((p) => ({ ...p, canvasWidth: 1080, canvasHeight: 1080 }))}>Square</button>
              <button type="button" className="quick-chip" onClick={() => setDesign((p) => ({ ...p, canvasWidth: 1920, canvasHeight: 1080 }))}>Landscape</button>
              <button type="button" className="quick-chip" onClick={() => setDesign((p) => ({ ...p, canvasWidth: 1080, canvasHeight: 1350 }))}>Social</button>
            </div>
          </div>

          <div className="control-group">
            <label className="control-label">Save & Export</label>
            <button
              type="button"
              onClick={() => void handleSaveAsImage()}
              className="btn-primary"
            >
              <Save size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Download Canvas
            </button>
            <p className="tiny-note" style={{ marginTop: '10px', textAlign: 'center', marginBottom: 0 }}>
              Export your design as a high-quality PNG image for sharing.
            </p>
          </div>

          <div className="control-group">
            <label className="control-label">Background</label>
            <div style={{ marginBottom: '10px' }}>
              <label className="tiny-note" style={{ display: 'block', marginBottom: '6px' }}>
                Image fit mode
              </label>
              <select
                className="input-field"
                value={design.imageFit}
                onChange={(event) =>
                  updateDesign('imageFit', event.target.value as DesignState['imageFit'])
                }
                style={{ marginBottom: 0 }}
              >
                <option value="cover">Fill Canvas</option>
                <option value="contain">Fit Entire Image</option>
              </select>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label className="tiny-note" style={{ display: 'block', marginBottom: '6px' }}>
                Image zoom: {design.imageZoom}%
              </label>
              <input
                type="range"
                min="20"
                max="300"
                value={design.imageZoom}
                onChange={(event) => updateDesign('imageZoom', Number(event.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div className="range-grid">
              <div>
                <label className="tiny-note">Image X: {design.imagePositionX}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={design.imagePositionX}
                  onChange={(event) => updateDesign('imagePositionX', Number(event.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="tiny-note">Image Y: {design.imagePositionY}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={design.imagePositionY}
                  onChange={(event) => updateDesign('imagePositionY', Number(event.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="tiny-note">Brightness: {design.imageBrightness}%</label>
                <input
                  type="range"
                  min="40"
                  max="180"
                  value={design.imageBrightness}
                  onChange={(event) => updateDesign('imageBrightness', Number(event.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="tiny-note">Contrast: {design.imageContrast}%</label>
                <input
                  type="range"
                  min="40"
                  max="180"
                  value={design.imageContrast}
                  onChange={(event) => updateDesign('imageContrast', Number(event.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="tiny-note">Saturation: {design.imageSaturation}%</label>
                <input
                  type="range"
                  min="0"
                  max="220"
                  value={design.imageSaturation}
                  onChange={(event) => updateDesign('imageSaturation', Number(event.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="tiny-note">Blur: {design.imageBlur}px</label>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={design.imageBlur}
                  onChange={(event) => updateDesign('imageBlur', Number(event.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="tiny-note">Grayscale: {design.imageGrayscale}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={design.imageGrayscale}
                  onChange={(event) => updateDesign('imageGrayscale', Number(event.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                className="input-field"
                placeholder="Search Pexels..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                style={{ marginBottom: 0 }}
              />
              <button
                type="button"
                aria-label="Search Pexels backgrounds"
                onClick={() => void handleSearch()}
                className="btn-primary"
                style={{ width: 'auto', padding: '10px' }}
                disabled={isLoadingImages}
              >
                {isLoadingImages ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Search size={18} />
                )}
              </button>
            </div>

            <div className="image-grid">
              {searchResults.map((url) => (
                <img
                  key={url}
                  src={url}
                  className="grid-image"
                  onClick={() => updateDesign('imageUrl', url)}
                  alt="Background option"
                />
              ))}
            </div>

            <div style={{ marginTop: '12px' }}>
              <label className="btn-primary" style={{ display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                <PlusCircle size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                Upload Photo
                <input type="file" hidden onChange={handleFileUpload} accept="image/*" />
              </label>
            </div>
            <p className="tiny-note" style={{ marginTop: '8px', marginBottom: 0 }}>
              {textInstruction}
            </p>
            <button type="button" className="btn-secondary" style={{ marginTop: '10px' }} onClick={resetImageAdjustments}>
              Reset image adjustments
            </button>
          </div>

          <div className="control-group">
            <label className="control-label">Overlay Opacity</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={design.overlayOpacity}
              onChange={(event) => updateDesign('overlayOpacity', Number(event.target.value))}
            />
          </div>

          <div className="control-group">
            <label className="control-label">Share with Developer</label>
            <button
              type="button"
              onClick={() => void handleShareWithDeveloper()}
              className="btn-primary"
            >
              <Share2 size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Share Design
            </button>
            <p className="tiny-note" style={{ marginTop: '10px', textAlign: 'center', marginBottom: 0 }}>
              This will send a copy of your current design and its configuration settings to the <a href="https://www.biblicalencouragement.org/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>developer</a>.
            </p>
          </div>

          <div className="control-group">
            <button type="button" className="btn-primary" onClick={resetAllToDefault}>
              Universal Reset
            </button>
          </div>

          <div className="control-group">
            <label className="control-label">Privacy & Legal</label>
            <p className="tiny-note">
              {allowExternalContent
                ? 'External services enabled. Third-party providers may process personal data.'
                : 'External services disabled. Local-only mode is active.'}
            </p>
            <div className="legal-links">
              <a href="/privacy.html" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              <a href="/terms.html" target="_blank" rel="noopener noreferrer">
                Terms of Use
              </a>
            </div>
            <button type="button" className="btn-secondary" style={{ marginTop: '10px' }} onClick={reopenPrivacyChoices}>
              Update Privacy Choices
            </button>
          </div>

          <div className="control-group social-media-section" style={{ borderBottom: 'none', textAlign: 'center' }}>
            <label className="control-label" style={{ marginBottom: '12px' }}>Follow Us</label>
            <div className="social-links" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <a href="https://www.facebook.com/bencouragement" target="_blank" rel="noopener noreferrer" className="social-icon" title="Facebook">
                <Facebook size={20} />
              </a>
              <a href="https://www.instagram.com/bencouragement/" target="_blank" rel="noopener noreferrer" className="social-icon" title="Instagram">
                <Instagram size={20} />
              </a>
              <a href="https://twitter.com/WBEncouragement" target="_blank" rel="noopener noreferrer" className="social-icon" title="Twitter">
                <Twitter size={20} />
              </a>
              <a href="https://www.tiktok.com/@bencouragment?_t=8V24bF5DpP9&_r=1" target="_blank" rel="noopener noreferrer" className="social-icon" title="TikTok">
                <Music size={20} />
              </a>
              <a href="https://www.youtube.com/channel/UCCD59etJ75JKCI29hS0DN2Q?" target="_blank" rel="noopener noreferrer" className="social-icon" title="YouTube">
                <Youtube size={20} />
              </a>
              <a href="https://bsky.app/profile/bencouragement.bsky.social" target="_blank" rel="noopener noreferrer" className="social-icon" title="BlueSky">
                <Cloud size={20} />
              </a>
              <a href="https://www.pinterest.com/bibleencouragement" target="_blank" rel="noopener noreferrer" className="social-icon" title="Pinterest">
                <Pin size={20} />
              </a>
              <a href="mailto:casmedlin@wbem.org" target="_blank" rel="noopener noreferrer" className="social-icon" title="Email">
                <Mail size={20} />
              </a>
            </div>
            <p className="tiny-note" style={{ marginTop: '12px' }}>
              &copy; {new Date().getFullYear()} Biblical Canvas
            </p>
          </div>

          {statusMessage ? <p className="status-message">{statusMessage}</p> : null}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-links">
            <a href="https://canvas.biblicalencouragement.org/privacy.html" target="_blank" rel="noopener noreferrer">Privacy</a>
            <span className="footer-separator">|</span>
            <a href="https://canvas.biblicalencouragement.org/terms.html" target="_blank" rel="noopener noreferrer">Terms</a>
            <span className="footer-separator">|</span>
            <a href="https://canvas.biblicalencouragement.org/sitemap.xml" target="_blank" rel="noopener noreferrer">Sitemap</a>
            <span className="footer-separator">|</span>
            <a href="https://canvas.biblicalencouragement.org/robots.txt" target="_blank" rel="noopener noreferrer">Robots</a>
          </div>
          <div className="sidebar-credit">
            Built by <a href="https://casmedlin.com" target="_blank" rel="noopener noreferrer author">Cas Medlin</a>
          </div>
        </div>
      </aside>

      <main className="canvas-area" ref={previewAreaRef}>
        <div className="canvas-stage" style={{ transform: `scale(${previewZoom})` }}>
          <div
            className="canvas-wrapper"
            style={{ width: `${design.canvasWidth}px`, height: `${design.canvasHeight}px` }}
          >
          <div ref={canvasRef} className="wallpaper-canvas" style={{ color: design.textColor }}>
            <div
              className={`background-layer ${selectedBox === 'image' ? 'selected' : ''}`}
              onMouseDown={(event) => startImageDrag(event.clientX, event.clientY)}
              onTouchStart={(event) => {
                const touch = event.touches[0];
                if (touch) {
                  startImageDrag(touch.clientX, touch.clientY);
                }
              }}
              style={{
                backgroundImage: `url(${design.imageUrl})`,
                backgroundSize: design.imageFit,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: `${design.imagePositionX}% ${design.imagePositionY}%`,
                transform: `scale(${design.imageZoom / 100})`,
                transformOrigin: `${design.imagePositionX}% ${design.imagePositionY}%`,
                filter: `brightness(${design.imageBrightness}%) contrast(${design.imageContrast}%) saturate(${design.imageSaturation}%) blur(${design.imageBlur}px) grayscale(${design.imageGrayscale}%)`,
                cursor: interaction?.mode === 'drag-image' ? 'grabbing' : 'grab'
              }}
            />
            <div className="overlay" style={{ background: `rgba(0,0,0,${design.overlayOpacity})` }}></div>
            {design.showQuotes ? <div className="quote quote-open">"</div> : null}
            <div
              className={`verse-box ${selectedBox === 'verse' ? 'selected' : ''}`}
              style={{
                fontFamily: design.fontFamily,
                fontSize: `${design.verseFontSize}rem`,
                fontWeight: design.fontWeight,
                lineHeight: design.lineHeight,
                letterSpacing: `${design.letterSpacing}px`,
                color: design.textColor,
                textShadow: `0 ${design.textShadow}px ${design.textShadow * 2}px rgba(0,0,0,0.5)`,
                textTransform: design.uppercaseText ? 'uppercase' : 'none',
                textAlign: design.textAlignment,
                left: `${design.verseBox.x}%`,
                top: `${design.verseBox.y}%`,
                width: `${design.verseBox.width}%`,
                position: 'absolute',
                transform: `translate(-50%, -50%) rotate(${design.textRotation}deg)`,
              }}
              onMouseDown={(event) => startDrag('verse', event.clientX, event.clientY)}
              onTouchStart={(event) => {
                const touch = event.touches[0];
                if (touch) {
                  startDrag('verse', touch.clientX, touch.clientY);
                }
              }}
            >
              {design.verse}
            </div>
            {design.showReference ? (
              <div
                className={`reference-box ${selectedBox === 'reference' ? 'selected' : ''}`}
                style={{
                  fontFamily: design.fontFamily,
                  fontSize: `${design.referenceFontSize}rem`,
                  fontWeight: design.fontWeight,
                  color: design.textColor,
                  textShadow: `0 ${design.textShadow}px ${design.textShadow * 2}px rgba(0,0,0,0.5)`,
                  textAlign: design.textAlignment,
                  left: `${design.referenceBox.x}%`,
                  top: `${design.referenceBox.y}%`,
                  width: `${design.referenceBox.width}%`,
                  position: 'absolute',
                  transform: `translate(-50%, -50%) rotate(${design.textRotation}deg)`,
                }}
                onMouseDown={(event) => startDrag('reference', event.clientX, event.clientY)}
                onTouchStart={(event) => {
                  const touch = event.touches[0];
                  if (touch) {
                    startDrag('reference', touch.clientX, touch.clientY);
                  }
                }}
              >
                {design.reference}{design.showVersion ? ` (${design.versionLabel})` : ''}
              </div>
            ) : null}
            {design.showQuotes ? <div className="quote quote-close">"</div> : null}
          </div>
          {design.imageFit === 'contain' ? <div className="contain-backdrop" /> : null}
        </div>
        </div>

        <button
          type="button"
          className="share-fab"
          onClick={() => void handleNativeShare()}
          title="Share Design"
          aria-label="Share design via device menu"
        >
          <Share2 />
        </button>
        <button
          type="button"
          className="download-fab"
          onClick={() => void handleSaveAsImage()}
          title="Download Image"
          aria-label="Download image as PNG"
        >
          <Download />
        </button>
        <div className="zoom-badge">Auto Fit: {(previewZoom * 100).toFixed(0)}%</div>
        {showPrivacyBanner ? (
          <div className="consent-banner" role="dialog" aria-live="polite" aria-label="Privacy choices">
            <p>
              Allow external providers for Google Fonts, Pexels image search, and expanded Bible catalogs?
            </p>
            <div className="consent-actions">
              <button type="button" className="btn-primary" onClick={() => savePrivacyPreferences(true)}>
                Allow External Services
              </button>
              <button type="button" className="btn-secondary" onClick={() => savePrivacyPreferences(false)}>
                Keep Local-Only Mode
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default App;
