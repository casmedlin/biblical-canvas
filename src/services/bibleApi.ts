export interface BibleVersionOption {
  id: string;
  name: string;
  language: string;
  source: 'api-bible' | 'bible-api';
}

export interface VerseResult {
  text: string;
  reference: string;
  versionLabel: string;
}

interface ApiBibleVersion {
  id: string;
  name: string;
  language?: {
    name?: string;
  };
}

interface ApiBibleVersionsResponse {
  data?: ApiBibleVersion[];
}

interface BibleApiResponse {
  text?: string;
  reference?: string;
}

interface ApiBibleSearchPassage {
  reference?: string;
  content?: string;
}

interface ApiBibleSearchData {
  passages?: ApiBibleSearchPassage[];
}

interface ApiBibleSearchResponse {
  data?: ApiBibleSearchData;
}

const API_BIBLE_KEY = import.meta.env.VITE_API_BIBLE_KEY;
const API_BIBLE_BASE = 'https://api.scripture.api.bible/v1';

const DEFAULT_BIBLE_VERSIONS: BibleVersionOption[] = [
  { id: 'niv', name: 'New International Version (NIV)', language: 'English', source: 'bible-api' },
  { id: 'kjv', name: 'King James Version (KJV)', language: 'English', source: 'bible-api' },
  { id: 'nlt', name: 'New Living Translation (NLT)', language: 'English', source: 'bible-api' },
  { id: 'esv', name: 'English Standard Version (ESV)', language: 'English', source: 'bible-api' },
  { id: 'nkjv', name: 'New King James Version (NKJV)', language: 'English', source: 'bible-api' },
  { id: 'nasb', name: 'New American Standard Bible (NASB)', language: 'English', source: 'bible-api' },
  { id: 'csb', name: 'Christian Standard Bible (CSB)', language: 'English', source: 'bible-api' },
  { id: 'nrsv', name: 'New Revised Standard Version (NRSV)', language: 'English', source: 'bible-api' },
  { id: 'net', name: 'New English Translation (NET)', language: 'English', source: 'bible-api' },
  { id: 'web', name: 'World English Bible (WEB)', language: 'English', source: 'bible-api' },
  { id: 'bbe', name: 'Bible in Basic English (BBE)', language: 'English', source: 'bible-api' },
  { id: 'oeb-us', name: 'Open English Bible US (OEB-US)', language: 'English', source: 'bible-api' },
  { id: 'asv', name: 'American Standard Version (ASV)', language: 'English', source: 'bible-api' },
  { id: 'ylt', name: 'Young\'s Literal Translation (YLT)', language: 'English', source: 'bible-api' },
  { id: 'webbe', name: 'World English Bible British Edition (WEBBE)', language: 'English', source: 'bible-api' },
  { id: 'clementine', name: 'Clementine Latin Vulgate', language: 'Latin', source: 'bible-api' },
  { id: 'almeida', name: 'Joao Ferreira de Almeida', language: 'Portuguese', source: 'bible-api' },
  { id: 'rccv', name: 'Reina Valera Contemporanea', language: 'Spanish', source: 'bible-api' },
  { id: 'cherokee', name: 'Cherokee New Testament', language: 'Cherokee', source: 'bible-api' },
  { id: 'cuv', name: 'Chinese Union Version', language: 'Chinese', source: 'bible-api' },
  { id: 'cuvs', name: 'Chinese Union Simplified', language: 'Chinese', source: 'bible-api' },
  { id: 'cuvt', name: 'Chinese Union Traditional', language: 'Chinese', source: 'bible-api' },
  { id: 'oeb-cw', name: 'Open English Bible Commonwealth', language: 'English', source: 'bible-api' },
  { id: 'darby', name: 'Darby Bible', language: 'English', source: 'bible-api' },
  { id: 'dra', name: 'Douay-Rheims 1899', language: 'English', source: 'bible-api' },
  { id: 'vulgate', name: 'Latin Vulgate', language: 'Latin', source: 'bible-api' },
  { id: 'lxx', name: 'Septuagint (LXX)', language: 'Greek', source: 'bible-api' },
  { id: 'rv1909', name: 'Reina Valera 1909', language: 'Spanish', source: 'bible-api' },
  { id: 'segond', name: 'Louis Segond 1910', language: 'French', source: 'bible-api' },
  { id: 'schlachter', name: 'Schlachter 1951', language: 'German', source: 'bible-api' }
];

const stripHtml = (value: string) =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const fetchBibleVersions = async (): Promise<BibleVersionOption[]> => {
  if (!API_BIBLE_KEY) {
    return DEFAULT_BIBLE_VERSIONS;
  }

  try {
    const response = await fetch(`${API_BIBLE_BASE}/bibles?limit=1000`, {
      headers: {
        'api-key': API_BIBLE_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`API.Bible versions request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as ApiBibleVersionsResponse;
    const data = payload.data ?? [];

    if (data.length === 0) {
      return DEFAULT_BIBLE_VERSIONS;
    }

    const uniqueById = new Map<string, BibleVersionOption>();

    for (const item of data) {
      if (!item.id || !item.name) continue;

      uniqueById.set(item.id, {
        id: item.id,
        name: item.name,
        language: item.language?.name ?? 'Unknown',
        source: 'api-bible'
      });
    }

    return Array.from(uniqueById.values()).sort((a, b) =>
      `${a.language} ${a.name}`.localeCompare(`${b.language} ${b.name}`)
    );
  } catch {
    return DEFAULT_BIBLE_VERSIONS;
  }
};

const fetchFromBibleApi = async (
  reference: string,
  versionId: string,
  versionLabel: string
): Promise<VerseResult> => {
  const response = await fetch(
    `https://bible-api.com/${encodeURIComponent(reference)}?translation=${encodeURIComponent(versionId)}`
  );

  if (!response.ok) {
    throw new Error(`bible-api request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as BibleApiResponse;

  if (!payload.text || !payload.reference) {
    throw new Error('bible-api returned no text');
  }

  return {
    text: payload.text.replace(/\n/g, ' ').trim(),
    reference: payload.reference,
    versionLabel
  };
};

const fetchFromApiBible = async (
  reference: string,
  versionId: string,
  versionLabel: string
): Promise<VerseResult> => {
  if (!API_BIBLE_KEY) {
    throw new Error('API.Bible key not configured');
  }

  const response = await fetch(
    `${API_BIBLE_BASE}/bibles/${encodeURIComponent(versionId)}/search?query=${encodeURIComponent(reference)}&limit=1`,
    {
      headers: {
        'api-key': API_BIBLE_KEY
      }
    }
  );

  if (!response.ok) {
    throw new Error(`API.Bible verse search failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiBibleSearchResponse;
  const firstPassage = payload.data?.passages?.[0];

  if (!firstPassage?.content || !firstPassage.reference) {
    throw new Error('API.Bible returned no passage');
  }

  return {
    text: stripHtml(firstPassage.content),
    reference: firstPassage.reference,
    versionLabel
  };
};

export const fetchVerse = async (
  reference: string,
  version: BibleVersionOption
): Promise<VerseResult> => {
  if (version.source === 'api-bible') {
    try {
      return await fetchFromApiBible(reference, version.id, version.name);
    } catch {
      return fetchFromBibleApi(reference, 'web', 'World English Bible (WEB)');
    }
  }

  try {
    return await fetchFromBibleApi(reference, version.id, version.name);
  } catch {
    return fetchFromBibleApi(
      reference,
      'web',
      `World English Bible (WEB) fallback for ${version.name}`
    );
  }
};

export const getDefaultBibleVersions = () => DEFAULT_BIBLE_VERSIONS;
