/**
 * Dictionary Catalog for Offline Spell Checker
 * Powered by wooorm/dictionaries, LibreOffice, and Glutanimate Medical Dictionary.
 */

export interface DictionaryInfo {
    code: string;
    name: string;
    affUrl: string;
    dicUrl: string;
    affFileName: string;
    dicFileName: string;
    isPopular?: boolean;
    isCustomBundle?: 'en-IN' | 'en-med';
}

const WOOORM_BASE = "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries";

export const DEFAULT_DICTIONARY_CODE = "en-US";

export const DICTIONARY_CATALOG: DictionaryInfo[] = [
    // Top Featured & Popular Options
    {
        code: "en-US",
        name: "English (United States)",
        affUrl: `${WOOORM_BASE}/en/index.aff`,
        dicUrl: `${WOOORM_BASE}/en/index.dic`,
        affFileName: "en-US.aff",
        dicFileName: "en-US.dic",
        isPopular: true
    },
    {
        code: "en-IN",
        name: "English (India)",
        affUrl: `${WOOORM_BASE}/en-GB/index.aff`,
        dicUrl: `${WOOORM_BASE}/en-GB/index.dic`,
        affFileName: "en-IN.aff",
        dicFileName: "en-IN.dic",
        isPopular: true,
        isCustomBundle: 'en-IN'
    },
    {
        code: "en-med",
        name: "English (Medical - Glutanimate Comprehensive)",
        affUrl: "generate:utf8",
        dicUrl: "https://raw.githubusercontent.com/glutanimate/hunspell-en-med-glut/master/en_med_glut.dic",
        affFileName: "en-med.aff",
        dicFileName: "en-med.dic",
        isPopular: true,
        isCustomBundle: 'en-med'
    },
    {
        code: "en-GB",
        name: "English (United Kingdom)",
        affUrl: `${WOOORM_BASE}/en-GB/index.aff`,
        dicUrl: `${WOOORM_BASE}/en-GB/index.dic`,
        affFileName: "en-GB.aff",
        dicFileName: "en-GB.dic",
        isPopular: true
    },
    {
        code: "en-CA",
        name: "English (Canada)",
        affUrl: `${WOOORM_BASE}/en-CA/index.aff`,
        dicUrl: `${WOOORM_BASE}/en-CA/index.dic`,
        affFileName: "en-CA.aff",
        dicFileName: "en-CA.dic",
        isPopular: true
    },
    {
        code: "en-AU",
        name: "English (Australia)",
        affUrl: `${WOOORM_BASE}/en-AU/index.aff`,
        dicUrl: `${WOOORM_BASE}/en-AU/index.dic`,
        affFileName: "en-AU.aff",
        dicFileName: "en-AU.dic",
        isPopular: true
    },
    {
        code: "hi-IN",
        name: "Hindi (India)",
        affUrl: "https://raw.githubusercontent.com/LibreOffice/dictionaries/master/hi_IN/hi_IN.aff",
        dicUrl: "https://raw.githubusercontent.com/LibreOffice/dictionaries/master/hi_IN/hi_IN.dic",
        affFileName: "hi-IN.aff",
        dicFileName: "hi-IN.dic",
        isPopular: true
    },
    {
        code: "es",
        name: "Spanish",
        affUrl: `${WOOORM_BASE}/es/index.aff`,
        dicUrl: `${WOOORM_BASE}/es/index.dic`,
        affFileName: "es.aff",
        dicFileName: "es.dic",
        isPopular: true
    },
    {
        code: "fr",
        name: "French",
        affUrl: `${WOOORM_BASE}/fr/index.aff`,
        dicUrl: `${WOOORM_BASE}/fr/index.dic`,
        affFileName: "fr.aff",
        dicFileName: "fr.dic",
        isPopular: true
    },
    {
        code: "de",
        name: "German",
        affUrl: `${WOOORM_BASE}/de/index.aff`,
        dicUrl: `${WOOORM_BASE}/de/index.dic`,
        affFileName: "de.aff",
        dicFileName: "de.dic",
        isPopular: true
    },
    {
        code: "it",
        name: "Italian",
        affUrl: `${WOOORM_BASE}/it/index.aff`,
        dicUrl: `${WOOORM_BASE}/it/index.dic`,
        affFileName: "it.aff",
        dicFileName: "it.dic",
        isPopular: true
    },
    {
        code: "pt-BR",
        name: "Portuguese (Brazil)",
        affUrl: `${WOOORM_BASE}/pt/index.aff`,
        dicUrl: `${WOOORM_BASE}/pt/index.dic`,
        affFileName: "pt-BR.aff",
        dicFileName: "pt-BR.dic",
        isPopular: true
    },
    {
        code: "pt-PT",
        name: "Portuguese (Portugal)",
        affUrl: `${WOOORM_BASE}/pt-PT/index.aff`,
        dicUrl: `${WOOORM_BASE}/pt-PT/index.dic`,
        affFileName: "pt-PT.aff",
        dicFileName: "pt-PT.dic",
        isPopular: true
    },
    {
        code: "ru",
        name: "Russian",
        affUrl: `${WOOORM_BASE}/ru/index.aff`,
        dicUrl: `${WOOORM_BASE}/ru/index.dic`,
        affFileName: "ru.aff",
        dicFileName: "ru.dic",
        isPopular: true
    },
    {
        code: "nl",
        name: "Dutch",
        affUrl: `${WOOORM_BASE}/nl/index.aff`,
        dicUrl: `${WOOORM_BASE}/nl/index.dic`,
        affFileName: "nl.aff",
        dicFileName: "nl.dic",
        isPopular: true
    },
    {
        code: "pl",
        name: "Polish",
        affUrl: `${WOOORM_BASE}/pl/index.aff`,
        dicUrl: `${WOOORM_BASE}/pl/index.dic`,
        affFileName: "pl.aff",
        dicFileName: "pl.dic",
        isPopular: true
    },
    {
        code: "sv",
        name: "Swedish",
        affUrl: `${WOOORM_BASE}/sv/index.aff`,
        dicUrl: `${WOOORM_BASE}/sv/index.dic`,
        affFileName: "sv.aff",
        dicFileName: "sv.dic"
    },
    {
        code: "tr",
        name: "Turkish",
        affUrl: `${WOOORM_BASE}/tr/index.aff`,
        dicUrl: `${WOOORM_BASE}/tr/index.dic`,
        affFileName: "tr.aff",
        dicFileName: "tr.dic"
    },
    {
        code: "uk",
        name: "Ukrainian",
        affUrl: `${WOOORM_BASE}/uk/index.aff`,
        dicUrl: `${WOOORM_BASE}/uk/index.dic`,
        affFileName: "uk.aff",
        dicFileName: "uk.dic"
    },
    {
        code: "cs",
        name: "Czech",
        affUrl: `${WOOORM_BASE}/cs/index.aff`,
        dicUrl: `${WOOORM_BASE}/cs/index.dic`,
        affFileName: "cs.aff",
        dicFileName: "cs.dic"
    },
    {
        code: "da",
        name: "Danish",
        affUrl: `${WOOORM_BASE}/da/index.aff`,
        dicUrl: `${WOOORM_BASE}/da/index.dic`,
        affFileName: "da.aff",
        dicFileName: "da.dic"
    },
    {
        code: "el",
        name: "Greek",
        affUrl: `${WOOORM_BASE}/el/index.aff`,
        dicUrl: `${WOOORM_BASE}/el/index.dic`,
        affFileName: "el.aff",
        dicFileName: "el.dic"
    },
    {
        code: "hu",
        name: "Hungarian",
        affUrl: `${WOOORM_BASE}/hu/index.aff`,
        dicUrl: `${WOOORM_BASE}/hu/index.dic`,
        affFileName: "hu.aff",
        dicFileName: "hu.dic"
    },
    {
        code: "id",
        name: "Indonesian",
        affUrl: `${WOOORM_BASE}/id/index.aff`,
        dicUrl: `${WOOORM_BASE}/id/index.dic`,
        affFileName: "id.aff",
        dicFileName: "id.dic"
    },
    {
        code: "nb",
        name: "Norwegian Bokmål",
        affUrl: `${WOOORM_BASE}/nb/index.aff`,
        dicUrl: `${WOOORM_BASE}/nb/index.dic`,
        affFileName: "nb.aff",
        dicFileName: "nb.dic"
    },
    {
        code: "nn",
        name: "Norwegian Nynorsk",
        affUrl: `${WOOORM_BASE}/nn/index.aff`,
        dicUrl: `${WOOORM_BASE}/nn/index.dic`,
        affFileName: "nn.aff",
        dicFileName: "nn.dic"
    },
    {
        code: "ro",
        name: "Romanian",
        affUrl: `${WOOORM_BASE}/ro/index.aff`,
        dicUrl: `${WOOORM_BASE}/ro/index.dic`,
        affFileName: "ro.aff",
        dicFileName: "ro.dic"
    },
    {
        code: "sk",
        name: "Slovak",
        affUrl: `${WOOORM_BASE}/sk/index.aff`,
        dicUrl: `${WOOORM_BASE}/sk/index.dic`,
        affFileName: "sk.aff",
        dicFileName: "sk.dic"
    },
    {
        code: "bg",
        name: "Bulgarian",
        affUrl: `${WOOORM_BASE}/bg/index.aff`,
        dicUrl: `${WOOORM_BASE}/bg/index.dic`,
        affFileName: "bg.aff",
        dicFileName: "bg.dic"
    },
    {
        code: "ca",
        name: "Catalan",
        affUrl: `${WOOORM_BASE}/ca/index.aff`,
        dicUrl: `${WOOORM_BASE}/ca/index.dic`,
        affFileName: "ca.aff",
        dicFileName: "ca.dic"
    },
    {
        code: "hr",
        name: "Croatian",
        affUrl: `${WOOORM_BASE}/hr/index.aff`,
        dicUrl: `${WOOORM_BASE}/hr/index.dic`,
        affFileName: "hr.aff",
        dicFileName: "hr.dic"
    },
    {
        code: "et",
        name: "Estonian",
        affUrl: `${WOOORM_BASE}/et/index.aff`,
        dicUrl: `${WOOORM_BASE}/et/index.dic`,
        affFileName: "et.aff",
        dicFileName: "et.dic"
    },
    {
        code: "he",
        name: "Hebrew",
        affUrl: `${WOOORM_BASE}/he/index.aff`,
        dicUrl: `${WOOORM_BASE}/he/index.dic`,
        affFileName: "he.aff",
        dicFileName: "he.dic"
    },
    {
        code: "is",
        name: "Icelandic",
        affUrl: `${WOOORM_BASE}/is/index.aff`,
        dicUrl: `${WOOORM_BASE}/is/index.dic`,
        affFileName: "is.aff",
        dicFileName: "is.dic"
    },
    {
        code: "ko",
        name: "Korean",
        affUrl: `${WOOORM_BASE}/ko/index.aff`,
        dicUrl: `${WOOORM_BASE}/ko/index.dic`,
        affFileName: "ko.aff",
        dicFileName: "ko.dic"
    },
    {
        code: "lv",
        name: "Latvian",
        affUrl: `${WOOORM_BASE}/lv/index.aff`,
        dicUrl: `${WOOORM_BASE}/lv/index.dic`,
        affFileName: "lv.aff",
        dicFileName: "lv.dic"
    },
    {
        code: "lt",
        name: "Lithuanian",
        affUrl: `${WOOORM_BASE}/lt/index.aff`,
        dicUrl: `${WOOORM_BASE}/lt/index.dic`,
        affFileName: "lt.aff",
        dicFileName: "lt.dic"
    },
    {
        code: "sr",
        name: "Serbian",
        affUrl: `${WOOORM_BASE}/sr/index.aff`,
        dicUrl: `${WOOORM_BASE}/sr/index.dic`,
        affFileName: "sr.aff",
        dicFileName: "sr.dic"
    },
    {
        code: "sl",
        name: "Slovenian",
        affUrl: `${WOOORM_BASE}/sl/index.aff`,
        dicUrl: `${WOOORM_BASE}/sl/index.dic`,
        affFileName: "sl.aff",
        dicFileName: "sl.dic"
    },
    {
        code: "vi",
        name: "Vietnamese",
        affUrl: `${WOOORM_BASE}/vi/index.aff`,
        dicUrl: `${WOOORM_BASE}/vi/index.dic`,
        affFileName: "vi.aff",
        dicFileName: "vi.dic"
    },
    {
        code: "cy",
        name: "Welsh",
        affUrl: `${WOOORM_BASE}/cy/index.aff`,
        dicUrl: `${WOOORM_BASE}/cy/index.dic`,
        affFileName: "cy.aff",
        dicFileName: "cy.dic"
    },
    {
        code: "la",
        name: "Latin",
        affUrl: `${WOOORM_BASE}/la/index.aff`,
        dicUrl: `${WOOORM_BASE}/la/index.dic`,
        affFileName: "la.aff",
        dicFileName: "la.dic"
    },
    {
        code: "eo",
        name: "Esperanto",
        affUrl: `${WOOORM_BASE}/eo/index.aff`,
        dicUrl: `${WOOORM_BASE}/eo/index.dic`,
        affFileName: "eo.aff",
        dicFileName: "eo.dic"
    },
    {
        code: "gl",
        name: "Galician",
        affUrl: `${WOOORM_BASE}/gl/index.aff`,
        dicUrl: `${WOOORM_BASE}/gl/index.dic`,
        affFileName: "gl.aff",
        dicFileName: "gl.dic"
    },
    {
        code: "fa",
        name: "Persian",
        affUrl: `${WOOORM_BASE}/fa/index.aff`,
        dicUrl: `${WOOORM_BASE}/fa/index.dic`,
        affFileName: "fa.aff",
        dicFileName: "fa.dic"
    },
    {
        code: "hy",
        name: "Armenian",
        affUrl: `${WOOORM_BASE}/hy/index.aff`,
        dicUrl: `${WOOORM_BASE}/hy/index.dic`,
        affFileName: "hy.aff",
        dicFileName: "hy.dic"
    },
    {
        code: "eu",
        name: "Basque",
        affUrl: `${WOOORM_BASE}/eu/index.aff`,
        dicUrl: `${WOOORM_BASE}/eu/index.dic`,
        affFileName: "eu.aff",
        dicFileName: "eu.dic"
    },
    {
        code: "ga",
        name: "Irish",
        affUrl: `${WOOORM_BASE}/ga/index.aff`,
        dicUrl: `${WOOORM_BASE}/ga/index.dic`,
        affFileName: "ga.aff",
        dicFileName: "ga.dic"
    },
    {
        code: "mn",
        name: "Mongolian",
        affUrl: `${WOOORM_BASE}/mn/index.aff`,
        dicUrl: `${WOOORM_BASE}/mn/index.dic`,
        affFileName: "mn.aff",
        dicFileName: "mn.dic"
    },
    {
        code: "ne",
        name: "Nepali",
        affUrl: `${WOOORM_BASE}/ne/index.aff`,
        dicUrl: `${WOOORM_BASE}/ne/index.dic`,
        affFileName: "ne.aff",
        dicFileName: "ne.dic"
    }
];

export function getDictionaryByCode(code: string): DictionaryInfo | undefined {
    return DICTIONARY_CATALOG.find(d => d.code === code);
}

export function getDictionaryByFileName(fileName: string): DictionaryInfo | undefined {
    const base = fileName.replace(/\.(aff|dic)$/, '');
    return DICTIONARY_CATALOG.find(d => 
        d.code === base || 
        d.affFileName.startsWith(base) || 
        d.dicFileName.startsWith(base)
    );
}
