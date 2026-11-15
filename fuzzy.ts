/**
 * Guarded Fuzzy Matching Engine for Obsidian Spell Checker
 * 
 * Rules:
 * 1. Tokenise the query; word order doesn't matter, and every query word must match.
 * 2. Typo budget by query-word length (Damerau-Levenshtein, so transposition counts as 1 edit):
 *    - 1-4 letters: exact or prefix only (0 typos)
 *    - 5 letters: 1 typo against title/target words, 0 against general vocab in normal mode
 *    - 6-9 letters: 1 typo
 *    - 10+ letters: 2 typos
 * 3. Prefix matches count (e.g. "constit" finds "Constitution").
 * 4. Reject scattered-subsequence matches ("writing" must NOT match "Airbyte Checkpointing").
 * 5. A typo must not borrow a letter from the neighbouring word ("invoice" must NOT match "Brand Voice").
 * 6. Allow a dropped space ("polityrevision" finds "Polity Revision", "database" finds "Data Base Design").
 * 7. Setting: 'off' | 'normal' | 'loose'. Loose raises the typo budget by 1 and relaxes rule 5.
 */

export type FuzzyMode = 'off' | 'normal' | 'loose';

export interface FuzzyMatchResult {
    matched: boolean;
    score: number;
    reason?: string;
    bestDist?: number;
}

export interface CandidateItem {
    text: string;
    category?: 'title' | 'dictionary' | 'personal' | 'compound';
    source?: any;
    score?: number;
    matchReason?: string;
}

export const COMMON_PREFIXES = [
    'over', 'under', 'anti', 'non', 'pre', 'post', 'sub', 'super', 
    'inter', 'intra', 'co', 're', 'un', 'in', 'im', 'dis', 'mis', 
    'auto', 'bio', 'counter', 'cross', 'semi', 'multi', 'hyper', 'out', 
    'pseudo', 'cyber', 'eco', 'infra', 'macro', 'micro', 'mid', 'mini', 
    'neo', 'omni', 'para', 'photo', 'poly', 'proto', 'quasi', 'retro', 
    'tele', 'trans', 'ultra'
];

/**
 * Calculates the restricted Damerau-Levenshtein distance (Optimal String Alignment).
 * Insertions, deletions, substitutions, and adjacent transpositions count as 1 edit each.
 */
export function damerauLevenshtein(a: string, b: string): number {
    const la = a.length;
    const lb = b.length;
    if (la === 0) return lb;
    if (lb === 0) return la;

    const d: number[][] = [];
    for (let i = 0; i <= la; i++) {
        d[i] = new Array(lb + 1);
        d[i][0] = i;
    }
    for (let j = 0; j <= lb; j++) {
        d[0][j] = j;
    }

    for (let i = 1; i <= la; i++) {
        for (let j = 1; j <= lb; j++) {
            const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
            let val = Math.min(
                d[i - 1][j] + 1,        // deletion
                d[i][j - 1] + 1,        // insertion
                d[i - 1][j - 1] + cost   // substitution
            );

            // Adjacent transposition check
            if (i > 1 && j > 1 && 
                a.charAt(i - 1) === b.charAt(j - 2) && 
                a.charAt(i - 2) === b.charAt(j - 1)) {
                val = Math.min(val, d[i - 2][j - 2] + 1);
            }
            d[i][j] = val;
        }
    }

    return d[la][lb];
}

/**
 * Returns allowed typo budget by query-word length (Rule 2 & Rule 7).
 */
export function getTypoBudget(queryWordLength: number, isTitleWord: boolean, mode: FuzzyMode): number {
    if (mode === 'off') {
        return 0;
    }

    let budget = 0;
    if (queryWordLength <= 4) {
        budget = 0;
    } else if (queryWordLength === 5) {
        budget = isTitleWord ? 1 : 0;
    } else if (queryWordLength >= 6 && queryWordLength <= 9) {
        budget = 1;
    } else {
        budget = 2; // 10+ letters
    }

    // Rule 7: Loose raises typo budget by 1
    if (mode === 'loose') {
        budget += 1;
    }

    return budget;
}

/**
 * Matches an individual query token against a candidate string (word or compound).
 */
export function matchTokenAgainstCandidate(
    token: string, 
    candidate: string, 
    isTitleWord: boolean, 
    mode: FuzzyMode
): FuzzyMatchResult {
    // 1. Exact match
    if (token === candidate) {
        return { matched: true, score: 100, reason: 'exact', bestDist: 0 };
    }

    // 2. Exact prefix match (Rule 3)
    if (candidate.startsWith(token)) {
        const lengthDiff = candidate.length - token.length;
        const score = Math.max(80, 95 - lengthDiff * 0.5);
        return { matched: true, score, reason: 'exact-prefix', bestDist: 0 };
    }

    const budget = getTypoBudget(token.length, isTitleWord, mode);
    if (budget === 0) {
        return { matched: false, score: 0, bestDist: Infinity };
    }

    // 3. Typo match against entire candidate
    const fullDist = damerauLevenshtein(token, candidate);
    if (fullDist <= budget) {
        const score = 75 - fullDist * 10;
        return { matched: true, score, reason: `${fullDist} typo(s)`, bestDist: fullDist };
    }

    // 4. Prefix match with typos (Rule 3 + Rule 2)
    const minLen = Math.max(1, token.length - budget);
    const maxLen = Math.min(candidate.length, token.length + budget);
    let bestPrefixDist = Infinity;

    for (let len = minLen; len <= maxLen; len++) {
        const prefix = candidate.slice(0, len);
        const dist = damerauLevenshtein(token, prefix);
        if (dist < bestPrefixDist) {
            bestPrefixDist = dist;
        }
    }

    if (bestPrefixDist <= budget) {
        const score = 70 - bestPrefixDist * 10;
        return { matched: true, score, reason: `prefix with ${bestPrefixDist} typo(s)`, bestDist: bestPrefixDist };
    }

    return { matched: false, score: 0, bestDist: Infinity };
}

/**
 * Generates intelligent compound splits and prefix suggestions.
 * Solves words like "overreliance" -> "over-reliance", "over reliance", "reliance".
 */
export function getCompoundAndPrefixSuggestions(
    word: string, 
    isWordCorrect: (w: string) => boolean
): CandidateItem[] {
    const suggestions: CandidateItem[] = [];
    const lower = word.toLowerCase();

    // 1. Check known prefixes (e.g. over-reliance, non-stop, anti-social)
    for (const prefix of COMMON_PREFIXES) {
        if (lower.startsWith(prefix) && lower.length > prefix.length + 2) {
            const remainder = lower.slice(prefix.length);
            if (isWordCorrect(remainder)) {
                suggestions.push({
                    text: `${prefix}-${remainder}`,
                    score: 98,
                    matchReason: 'prefix compound',
                    category: 'compound'
                });
                suggestions.push({
                    text: `${prefix} ${remainder}`,
                    score: 95,
                    matchReason: 'two-word split',
                    category: 'compound'
                });
                suggestions.push({
                    text: remainder,
                    score: 85,
                    matchReason: 'root word',
                    category: 'compound'
                });
            }
        }
    }

    // 2. Check 2-word arbitrary splitting
    for (let i = 2; i <= lower.length - 2; i++) {
        const left = lower.slice(0, i);
        const right = lower.slice(i);
        if (isWordCorrect(left) && isWordCorrect(right)) {
            const hyphenated = `${left}-${right}`;
            const spaced = `${left} ${right}`;
            if (!suggestions.some(s => s.text === hyphenated)) {
                suggestions.push({
                    text: hyphenated,
                    score: 96,
                    matchReason: 'compound split',
                    category: 'compound'
                });
            }
            if (!suggestions.some(s => s.text === spaced)) {
                suggestions.push({
                    text: spaced,
                    score: 94,
                    matchReason: 'two-word split',
                    category: 'compound'
                });
            }
        }
    }

    // 3. Check CamelCase splitting (e.g. "MahilaSwarajya" -> "Mahila Swarajya")
    if (/[a-z][A-Z]/.test(word)) {
        const spaced = word.replace(/([a-z])([A-Z])/g, '$1 $2');
        suggestions.push({
            text: spaced,
            score: 97,
            matchReason: 'camelcase split',
            category: 'compound'
        });
    }

    return suggestions;
}

/**
 * Guarded Fuzzy Matcher evaluating a query against a target string.
 * Enforces all 7 rules.
 */
export function guardedFuzzyMatch(
    query: string, 
    target: string, 
    mode: FuzzyMode = 'normal',
    isTitle: boolean = true
): FuzzyMatchResult {
    if (!query || !target) {
        return { matched: false, score: 0 };
    }

    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) {
        return { matched: false, score: 0 };
    }

    // Rule 1: Tokenise the query. Word order does not matter.
    const queryTokens = trimmedQuery.split(/\s+/).filter(Boolean);
    if (queryTokens.length === 0) {
        return { matched: false, score: 0 };
    }

    // Extract target words cleanly respecting boundaries (Rule 5)
    const targetWords = target.toLowerCase().match(/[a-z0-9']+/g) || [];
    if (targetWords.length === 0) {
        return { matched: false, score: 0 };
    }

    let totalScore = 0;
    const reasons: string[] = [];

    // Rule 1: Every query word must match!
    for (const qToken of queryTokens) {
        let bestTokenMatch: FuzzyMatchResult = { matched: false, score: 0 };

        // Test single target words
        for (const tWord of targetWords) {
            const res = matchTokenAgainstCandidate(qToken, tWord, isTitle, mode);
            if (res.matched && res.score > bestTokenMatch.score) {
                bestTokenMatch = res;
            }
        }

        // Rule 6: Allow dropped space across contiguous words
        for (let i = 0; i < targetWords.length; i++) {
            let combined = targetWords[i];
            for (let j = i + 1; j < Math.min(targetWords.length, i + 4); j++) {
                combined += targetWords[j];
                const res = matchTokenAgainstCandidate(qToken, combined, isTitle, mode);
                if (res.matched && res.score > bestTokenMatch.score) {
                    bestTokenMatch = {
                        ...res,
                        reason: res.reason === 'exact' ? 'dropped space match' : `dropped space (${res.reason})`
                    };
                }
            }
        }

        // Rule 5 Relaxation in 'loose' mode:
        if (!bestTokenMatch.matched && mode === 'loose') {
            const rawTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
            const budget = getTypoBudget(qToken.length, isTitle, mode);
            for (let i = 0; i < rawTarget.length; i++) {
                const minLen = Math.max(1, qToken.length - budget);
                const maxLen = Math.min(rawTarget.length - i, qToken.length + budget);
                for (let len = minLen; len <= maxLen; len++) {
                    const sub = rawTarget.slice(i, i + len);
                    const dist = damerauLevenshtein(qToken, sub);
                    if (dist <= budget) {
                        bestTokenMatch = { 
                            matched: true, 
                            score: 55 - dist * 10,
                            reason: `loose substring match (${dist} typo)`,
                            bestDist: dist
                        };
                        break;
                    }
                }
                if (bestTokenMatch.matched) break;
            }
        }

        // If any query token fails to match, reject the entire target (Rule 1 & Rule 4)
        if (!bestTokenMatch.matched) {
            return { matched: false, score: 0 };
        }

        totalScore += bestTokenMatch.score;
        if (bestTokenMatch.reason) {
            reasons.push(bestTokenMatch.reason);
        }
    }

    return { 
        matched: true, 
        score: totalScore, 
        reason: reasons.join(', ') 
    };
}

/**
 * Filter and rank candidates using guarded fuzzy match.
 */
export function findGuardedFuzzyMatches(
    query: string,
    candidates: CandidateItem[],
    mode: FuzzyMode = 'normal',
    maxResults: number = 20
): CandidateItem[] {
    const results: CandidateItem[] = [];

    for (const item of candidates) {
        const isTitle = item.category === 'title' || item.category === undefined;
        const res = guardedFuzzyMatch(query, item.text, mode, isTitle);
        if (res.matched) {
            results.push({
                ...item,
                score: res.score,
                matchReason: res.reason
            });
        }
    }

    // Sort descending by score
    results.sort((a, b) => (b.score || 0) - (a.score || 0));

    return results.slice(0, maxResults);
}
