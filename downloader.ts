import { App, requestUrl } from 'obsidian';
import { DictionaryInfo, getDictionaryByFileName } from './languages';

export interface InstalledDictionary {
    baseName: string;
    name: string;
    affPath: string;
    dicPath: string;
    affSize: number;
    dicSize: number;
}

const INDIAN_ENGLISH_ADDITIONAL_WORDS = [
    "aadhaar", "adivasi", "adivasis", "ahimsa", "anganwadi", "anganwadis", 
    "ashram", "ashrams", "ayush", "bandh", "bandhs", "basti", "bastis", 
    "bazaar", "bharat", "bigha", "bighas", "bjp", "cantonment", "chappal", 
    "chappals", "charkha", "chaupal", "chowk", "crore", "crores", "crorepati", 
    "crorepatis", "dalit", "dalits", "desi", "deshi", "dharma", "dharna", 
    "dhoti", "fir", "ghat", "girmitiya", "gram", "gramin", "gurukul", 
    "hartal", "hartals", "haveli", "hawala", "hindutva", "jawan", "jawans", 
    "kisan", "kisans", "kurta", "lakh", "lakhs", "lakhi", "lathi", "lok", 
    "lokpal", "lokayukta", "madrasa", "mahajan", "mahal", "mahila", "mahilas", 
    "mahilaswarajya", "mandal", "mandis", "maratha", "masjid", "matru", 
    "mazdoor", "mohalla", "morcha", "mughal", "mukhiya", "nari", "narishakti", 
    "panch", "panchayat", "panchayati", "patel", "patwari", "prepone", 
    "preponed", "prepones", "preponing", "pujari", "purdah", "purna", "rabi", 
    "raj", "rajya", "rashtra", "rashtriya", "roti", "rupee", "rupees", 
    "ryot", "ryotwari", "sabha", "sadar", "sahitya", "samaj", "samiti", 
    "sangh", "sarpanch", "sarvodaya", "satyagraha", "satyagrahi", "seva", 
    "sevak", "shakti", "shiksha", "swaraj", "swarajya", "swadeshi", "tehsil", 
    "tehsildar", "thana", "thanedar", "upanyas", "utsav", "vidhan", "vidyut", 
    "vikas", "vishwa", "vyapar", "yatra", "yojana", "zamindar", "zamindari", "zila"
];

/**
 * Downloads a Hunspell dictionary (.aff and .dic) directly into the plugin's dicts folder.
 */
export async function downloadDictionary(
    app: App,
    pluginDir: string,
    dict: DictionaryInfo,
    onProgress?: (status: string) => void
): Promise<{ success: boolean; message: string }> {
    const adapter = app.vault.adapter;
    const dictDir = `${pluginDir}/dicts`;

    if (!(await adapter.exists(dictDir))) {
        await adapter.mkdir(dictDir);
    }

    try {
        let affText = "";

        // 1. Download or generate .aff file
        if (dict.affUrl === "generate:utf8") {
            if (onProgress) onProgress(`Generating UTF-8 affix profile for ${dict.name}...`);
            affText = "SET UTF-8\nTRY esianrtolcdugmphbyfvkwz'\n";
        } else {
            if (onProgress) onProgress(`Downloading ${dict.name} (.aff file)...`);
            const affResponse = await requestUrl({
                url: dict.affUrl,
                method: 'GET'
            });

            if (affResponse.status !== 200 || !affResponse.text) {
                return {
                    success: false,
                    message: `Failed to download .aff file for ${dict.name} (HTTP ${affResponse.status})`
                };
            }
            affText = affResponse.text;
        }

        const affDest = `${dictDir}/${dict.affFileName}`;
        await adapter.write(affDest, affText);

        // 2. Download .dic wordlist file
        if (onProgress) onProgress(`Downloading ${dict.name} (.dic wordlist)...`);

        const dicResponse = await requestUrl({
            url: dict.dicUrl,
            method: 'GET'
        });

        if (dicResponse.status !== 200 || !dicResponse.text) {
            return {
                success: false,
                message: `Failed to download .dic file for ${dict.name} (HTTP ${dicResponse.status})`
            };
        }

        let dicText = dicResponse.text;

        // Specialized customization for Indian English: append curated terms
        if (dict.isCustomBundle === 'en-IN') {
            const addedTerms = INDIAN_ENGLISH_ADDITIONAL_WORDS.join('\n');
            dicText = `${dicText.trim()}\n${addedTerms}\n`;
        }

        const dicDest = `${dictDir}/${dict.dicFileName}`;
        await adapter.write(dicDest, dicText);

        if (onProgress) onProgress(`Successfully installed ${dict.name}!`);

        return {
            success: true,
            message: `Successfully installed ${dict.name}`
        };

    } catch (error: any) {
        console.error(`Error downloading dictionary ${dict.name}:`, error);
        return {
            success: false,
            message: `Download failed: ${error?.message || String(error)}`
        };
    }
}

/**
 * Lists all currently installed dictionary pairs in the dicts folder.
 */
export async function getInstalledDictionaries(
    app: App,
    pluginDir: string
): Promise<InstalledDictionary[]> {
    const adapter = app.vault.adapter;
    const dictDir = `${pluginDir}/dicts`;

    if (!(await adapter.exists(dictDir))) {
        return [];
    }

    const installed: InstalledDictionary[] = [];

    try {
        const listing = await adapter.list(dictDir);
        const affFiles = listing.files.filter(f => f.endsWith('.aff'));

        for (const affPath of affFiles) {
            const baseNameWithDir = affPath.replace(/\.aff$/, '');
            const baseName = baseNameWithDir.split('/').pop() || baseNameWithDir;
            const dicPath = `${baseNameWithDir}.dic`;

            if (listing.files.includes(dicPath)) {
                let affSize = 0;
                let dicSize = 0;

                try {
                    const affStat = await adapter.stat(affPath);
                    if (affStat) affSize = affStat.size;
                    const dicStat = await adapter.stat(dicPath);
                    if (dicStat) dicSize = dicStat.size;
                } catch (e) {
                    // Stat optional
                }

                const catalogEntry = getDictionaryByFileName(baseName);
                const name = catalogEntry ? catalogEntry.name : baseName;

                installed.push({
                    baseName,
                    name,
                    affPath,
                    dicPath,
                    affSize,
                    dicSize
                });
            }
        }
    } catch (e) {
        console.error("Error listing installed dictionaries:", e);
    }

    return installed;
}

/**
 * Deletes a dictionary pair (.aff and .dic) from the dicts folder.
 */
export async function deleteDictionary(
    app: App,
    pluginDir: string,
    baseName: string
): Promise<boolean> {
    const adapter = app.vault.adapter;
    const dictDir = `${pluginDir}/dicts`;
    let deleted = false;

    const affPath = `${dictDir}/${baseName}.aff`;
    const dicPath = `${dictDir}/${baseName}.dic`;

    if (await adapter.exists(affPath)) {
        await adapter.remove(affPath);
        deleted = true;
    }
    if (await adapter.exists(dicPath)) {
        await adapter.remove(dicPath);
        deleted = true;
    }

    return deleted;
}
