# Offline Spell Checker for Obsidian (sxjeel & Shigeඞ)

A totally offline, high-speed spell checker for Obsidian with **built-in dictionary library downloads** and a **guarded fuzzy matching engine**.

---

## Key Features

### 1. Built-in Dictionary Downloader
No need to hunt for external files or copy `.aff` and `.dic` files manually:
- **One-Click Default Download**: Instantly download and install the official UTF-8 English (US) dictionary right inside Obsidian settings.
- **Over 45+ International Languages**: Built-in support for English (US, UK, Canada, Australia), Hindi (India), Spanish, French, German, Italian, Portuguese, Russian, and dozens more.
- **Installed Dictionaries Manager**: View active files, file sizes, and delete dictionaries with one click.
- **Personal Dictionary (`personal.txt`)**: Add custom UPSC words, names, and acronyms with duplicate protection.

### 2. Guarded Fuzzy Matching Engine
Fuzzy, but guarded. Fixes poor native suggestions and provides robust candidate matching:
1. **Tokenised Query**: Word order doesn't matter, and every query word must match (`ai writing` and `writing ai` return the same list).
2. **Typo Budget by Word Length (Damerau-Levenshtein)**:
   - 1–4 letters: exact or prefix only (0 typos)
   - 5 letters: 1 typo against title words (e.g. `Gitub` finds `GitHub`)
   - 6–9 letters: 1 typo
   - 10+ letters: 2 typos (e.g. `troubelshoot` finds `Obsidian Troubleshooting` via transposition)
3. **Prefix Matches Count**: `constit` finds `Constitution`.
4. **Reject Scattered-Subsequence Matches**: `writing` will **never** match `Airbyte Checkpointing`.
5. **No Cross-Word Letter Borrowing**: `invoice` will **never** match `Brand Voice` in normal mode.
6. **Dropped Space Support**: `polityrevision` finds `Polity Revision`, and `database` finds `Data Base Design`.
7. **Sensitivity Setting**:
   - `Off`: Strict exact and prefix matches only (0 typos).
   - `Normal` (Default): Guarded rules with full boundary protection.
   - `Loose`: Typo budget raised by 1, and rule 5 boundary protection relaxed.

### 3. Guarded Fuzzy Search & Lookup Command
- Press `Ctrl/Cmd + P` -> `Spell Checker: Guarded Fuzzy Search (Notes, Dictionary & Vocabulary)`
- Search any title, note, or dictionary term using the 7-rule guarded fuzzy matcher.
- Press Enter to jump to the note or insert into the active document.

---

## Commands
- `Spell Checker: Guarded Fuzzy Search (Notes, Dictionary & Vocabulary)`
- `Spell Checker: Toggle Spell Checker On/Off`
- `Spell Checker: Download Default English (US) Library`

