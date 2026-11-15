import {
    App,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    MarkdownView,
    Menu,
    Editor,
    FileSystemAdapter,
    Modal
} from 'obsidian';
import { RangeSetBuilder, Extension } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
// @ts-ignore
import nspell from 'nspell';

import {
    FuzzyMode,
    guardedFuzzyMatch,
    getTypoBudget,
    damerauLevenshtein,
    findGuardedFuzzyMatches,
    getCompoundAndPrefixSuggestions,
    COMMON_PREFIXES
} from './fuzzy';
import type {
    CandidateItem
} from './fuzzy';
import {
    DICTIONARY_CATALOG,
    DEFAULT_DICTIONARY_CODE,
    getDictionaryByCode,
    getDictionaryByFileName
} from './languages';
import type {
    DictionaryInfo
} from './languages';
import {
    downloadDictionary,
    getInstalledDictionaries,
    deleteDictionary
} from './downloader';
import type {
    InstalledDictionary
} from './downloader';
import { GuardedFuzzySearchModal } from './search-modal';

export type {
    FuzzyMode,
    CandidateItem,
    DictionaryInfo,
    InstalledDictionary
};
export {
    guardedFuzzyMatch,
    getTypoBudget,
    damerauLevenshtein,
    findGuardedFuzzyMatches,
    DICTIONARY_CATALOG,
    DEFAULT_DICTIONARY_CODE,
    getDictionaryByCode,
    getDictionaryByFileName,
    downloadDictionary,
    getInstalledDictionaries,
    deleteDictionary,
    GuardedFuzzySearchModal
};

export interface SpellCheckerSettings {
    isEnabled: boolean;
    fuzzyMode: FuzzyMode;
    includeNotesInSuggestions: boolean;
    acceptPrefixCompounds: boolean;
    selectedCatalogCode: string;
}

const DEFAULT_SETTINGS: SpellCheckerSettings = {
    isEnabled: true,
    fuzzyMode: 'normal',
    includeNotesInSuggestions: true,
    acceptPrefixCompounds: false,
    selectedCatalogCode: DEFAULT_DICTIONARY_CODE,
};

const spellcheckDecoration = Decoration.mark({ class: "sxjeel-misspelled" });

export default class OfflineSpellChecker extends Plugin {
    settings: SpellCheckerSettings;
    spellcheckers: any[] = [];
    loadedDictNames: string[] = [];
    masterVocabulary: string[] = [];
    personalWords: string[] = [];
    pluginExt: Extension;

    async onload() {
        await this.loadSettings();
        await this.initDictionaryFiles();
        await this.loadAllDictionaries();

        // 1. CodeMirror Extension for live highlighting
        this.pluginExt = ViewPlugin.fromClass(
            class {
                decorations: DecorationSet;
                plugin: OfflineSpellChecker;

                constructor(view: EditorView) {
                    this.plugin = (window as any).sxjeelSpellCheckerPluginInstance;
                    this.decorations = this.buildDecorations(view);
                }

                update(update: ViewUpdate) {
                    if (update.docChanged || update.viewportChanged) {
                        this.decorations = this.buildDecorations(update.view);
                    }
                }

                buildDecorations(view: EditorView): DecorationSet {
                    const builder = new RangeSetBuilder<Decoration>();
                    if (!this.plugin || !this.plugin.settings.isEnabled || this.plugin.spellcheckers.length === 0) {
                        return builder.finish();
                    }

                    const wordRegex = /\b[a-zA-Z']+\b/g;

                    for (const { from, to } of view.visibleRanges) {
                        const text = view.state.doc.sliceString(from, to);
                        let match;
                        while ((match = wordRegex.exec(text)) !== null) {
                            const word = match[0];
                            if (word.length > 1) {
                                if (!this.plugin.isWordCorrect(word)) {
                                    builder.add(from + match.index, from + match.index + word.length, spellcheckDecoration);
                                }
                            }
                        }
                    }
                    return builder.finish();
                }
            },
            { decorations: v => v.decorations }
        );

        (window as any).sxjeelSpellCheckerPluginInstance = this;
        this.registerEditorExtension(this.pluginExt);

        // 2. Right-Click Context Menu with Guarded Fuzzy Suggestions
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
                if (!this.settings.isEnabled || this.spellcheckers.length === 0) return;

                const cursor = editor.getCursor();
                const cm = (editor as any).cm;
                if (!cm || !cm.state) return;

                const pos = editor.posToOffset(cursor);
                const wordRange = cm.state.wordAt(pos);
                if (!wordRange) return;

                const word = cm.state.doc.sliceString(wordRange.from, wordRange.to);
                const fromPos = editor.offsetToPos(wordRange.from);
                const toPos = editor.offsetToPos(wordRange.to);

                if (word.length > 1 && !this.isWordCorrect(word)) {
                    menu.addSeparator();

                    const suggestions = this.getGuardedSuggestions(word);

                    if (suggestions.length === 0) {
                        menu.addItem((item) => {
                            item.setTitle("No suggestions found").setDisabled(true);
                        });
                    } else {
                        for (const suggestion of suggestions) {
                            menu.addItem((item) => {
                                item.setTitle(`Suggest: ${suggestion}`)
                                    .setIcon('check')
                                    .onClick(() => {
                                        editor.replaceRange(suggestion, fromPos, toPos);
                                    });
                            });
                        }
                    }

                    menu.addSeparator();
                    menu.addItem((item) => {
                        item.setTitle(`Add "${word}" to dictionary`)
                            .setIcon('plus-with-circle')
                            .onClick(async () => {
                                await this.addToPersonalDictionary(word);
                                new Notice(`Added "${word}" to personal dictionary`);
                                (this.app.workspace as any).updateOptions?.();
                                view.editor.focus();
                            });
                    });
                }
            })
        );

        // 3. Command: Guarded Fuzzy Search Modal
        this.addCommand({
            id: 'spell-checker-guarded-fuzzy-search',
            name: 'Guarded Fuzzy Search (Notes, Dictionary & Vocabulary)',
            callback: () => {
                new GuardedFuzzySearchModal(this.app, this).open();
            }
        });

        // 4. Command: Toggle Spell Checker (Instant, ZERO lag)
        this.addCommand({
            id: 'spell-checker-toggle',
            name: 'Toggle Spell Checker On/Off',
            callback: async () => {
                this.settings.isEnabled = !this.settings.isEnabled;
                await this.saveSettings();
                (this.app.workspace as any).updateOptions?.();
                new Notice(`Spell Checker: ${this.settings.isEnabled ? 'Enabled' : 'Disabled'}`);
            }
        });

        // 5. Command: Download Default English Library
        this.addCommand({
            id: 'spell-checker-download-default-library',
            name: 'Download Default English (US) Library',
            callback: async () => {
                const defaultDict = getDictionaryByCode(DEFAULT_DICTIONARY_CODE);
                if (defaultDict) {
                    new Notice("Starting download for English (US) dictionary...");
                    const res = await downloadDictionary(this.app, this.manifest.dir || '', defaultDict);
                    if (res.success) {
                        await this.loadAllDictionaries();
                        (this.app.workspace as any).updateOptions?.();
                        new Notice(`✅ ${res.message}`);
                    } else {
                        new Notice(`❌ ${res.message}`);
                    }
                }
            }
        });

        this.addSettingTab(new SpellCheckerSettingTab(this.app, this));
    }

    onunload() {
        delete (window as any).sxjeelSpellCheckerPluginInstance;
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        (this.app.workspace as any).updateOptions?.();
    }

    async initDictionaryFiles() {
        const adapter = this.app.vault.adapter;
        const dictDir = `${this.manifest.dir}/dicts`;

        if (!(await adapter.exists(dictDir))) {
            await adapter.mkdir(dictDir);
        }

        const personalDictPath = `${dictDir}/personal.txt`;
        if (!(await adapter.exists(personalDictPath))) {
            await adapter.write(personalDictPath, "");
        }
    }

    /**
     * Checks if a word is recognized as correct.
     */
    isWordCorrect(word: string): boolean {
        if (!word || word.length <= 1) return true;
        const lower = word.toLowerCase();

        // 1. Check personal dictionary
        if (this.personalWords.includes(lower)) {
            return true;
        }

        // 2. Check loaded Hunspell checkers
        for (const sp of this.spellcheckers) {
            try {
                if (sp.correct(word) || sp.correct(lower)) {
                    return true;
                }
            } catch (e) {
                // Ignore spelling engine errors on specific symbols
            }
        }

        // 3. Optional prefix compound recognition (e.g. "overreliance" -> "over" + "reliance")
        if (this.settings.acceptPrefixCompounds) {
            for (const p of COMMON_PREFIXES) {
                if (lower.startsWith(p) && lower.length > p.length + 2) {
                    const base = lower.slice(p.length);
                    if (this.isBaseWordCorrect(base)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private isBaseWordCorrect(base: string): boolean {
        if (this.personalWords.includes(base)) return true;
        for (const sp of this.spellcheckers) {
            try {
                if (sp.correct(base)) return true;
            } catch (e) {}
        }
        return false;
    }

    /**
     * Generates suggestions for a misspelled word using Guarded Fuzzy Matcher,
     * compound splitting (solving "overreliance" -> "over-reliance", "over reliance"),
     * CamelCase decomposition ("MahilaSwarajya" -> "Mahila Swarajya"), and note titles.
     */
    getGuardedSuggestions(word: string): string[] {
        const suggestions: Array<{ text: string; score: number }> = [];
        const lowerWord = word.toLowerCase();

        // 1. Intelligently generate compound and prefix splits (e.g. "overreliance" -> "over-reliance", "over reliance", "reliance")
        const compoundSplits = getCompoundAndPrefixSuggestions(word, (w) => this.isWordCorrect(w));
        for (const cs of compoundSplits) {
            suggestions.push({
                text: cs.text,
                score: cs.score || 95
            });
        }

        // 2. Native suggestions from nspell
        const nativeSuggestions: string[] = [];
        for (const sp of this.spellcheckers) {
            try {
                nativeSuggestions.push(...sp.suggest(word));
            } catch (e) {}
        }

        for (const ns of nativeSuggestions) {
            const res = guardedFuzzyMatch(word, ns, this.settings.fuzzyMode, false);
            suggestions.push({
                text: ns,
                score: res.matched ? res.score : 60
            });
        }

        // 3. Personal dictionary entries
        for (const pWord of this.personalWords) {
            const res = guardedFuzzyMatch(word, pWord, this.settings.fuzzyMode, true);
            if (res.matched) {
                suggestions.push({ text: pWord, score: res.score + 10 });
            }
        }

        // 4. Vault note titles (titles allow 1 typo at 5 letters, dropped space, etc.)
        if (this.settings.includeNotesInSuggestions) {
            const mdFiles = this.app.vault.getMarkdownFiles();
            for (const file of mdFiles) {
                const title = file.basename;
                const res = guardedFuzzyMatch(word, title, this.settings.fuzzyMode, true);
                if (res.matched) {
                    suggestions.push({ text: title, score: res.score + 5 });
                }
            }
        }

        // 5. Vocabulary scan using Guarded Fuzzy rules
        if (this.settings.fuzzyMode !== 'off') {
            const budget = getTypoBudget(lowerWord.length, false, this.settings.fuzzyMode);
            const minLen = Math.max(1, lowerWord.length - budget);
            const maxLen = lowerWord.length + budget + 4;

            for (const vWord of this.masterVocabulary) {
                if (vWord.length < minLen || vWord.length > maxLen) continue;
                const res = guardedFuzzyMatch(lowerWord, vWord, this.settings.fuzzyMode, false);
                if (res.matched) {
                    suggestions.push({ text: vWord, score: res.score });
                    if (suggestions.length > 60) break;
                }
            }
        }

        // Sort by score descending and deduplicate
        suggestions.sort((a, b) => b.score - a.score);

        const seen = new Set<string>();
        const unique: string[] = [];

        for (const s of suggestions) {
            const norm = s.text.toLowerCase();
            if (!seen.has(norm) && norm !== lowerWord) {
                seen.add(norm);
                unique.push(s.text);
                if (unique.length >= 6) break;
            }
        }

        return unique;
    }

    async loadAllDictionaries() {
        this.spellcheckers = [];
        this.loadedDictNames = [];
        this.masterVocabulary = [];
        this.personalWords = [];

        const adapter = this.app.vault.adapter;
        const dictDir = `${this.manifest.dir}/dicts`;

        try {
            // Load personal dictionary first
            const personalDictPath = `${dictDir}/personal.txt`;
            if (await adapter.exists(personalDictPath)) {
                const personalContent = await adapter.read(personalDictPath);
                if (personalContent) {
                    const lines = personalContent.split(/\r?\n/);
                    for (let pWord of lines) {
                        pWord = pWord.trim().toLowerCase();
                        if (pWord && !this.personalWords.includes(pWord)) {
                            this.personalWords.push(pWord);
                            this.masterVocabulary.push(pWord);
                        }
                    }
                }
            }

            // Load Hunspell .aff and .dic pairs
            const files = await adapter.list(dictDir);
            const affFiles = files.files.filter(f => f.endsWith('.aff'));

            for (const affPath of affFiles) {
                const baseName = affPath.replace(/\.aff$/, '');
                const dicPath = `${baseName}.dic`;

                if (files.files.includes(dicPath)) {
                    try {
                        const affFile = await adapter.read(affPath);
                        const dicFile = await adapter.read(dicPath);

                        const sp = nspell(affFile, dicFile);

                        // Inject personal dictionary words
                        if (this.personalWords.length > 0) {
                            sp.personal(this.personalWords.join('\n'));
                        }

                        this.spellcheckers.push(sp);

                        const rawName = baseName.split('/').pop() || baseName;
                        const catalogInfo = getDictionaryByFileName(rawName);
                        this.loadedDictNames.push(catalogInfo ? catalogInfo.name : rawName);

                        // Parse out clean vocabulary words for fallback guarded matching
                        const lines = dicFile.split(/\r?\n/);
                        for (let line of lines) {
                            line = line.trim();
                            if (!line || /^\d+$/.test(line)) continue;
                            const cleanWord = line.split('/')[0].toLowerCase();
                            if (cleanWord.length > 1) {
                                this.masterVocabulary.push(cleanWord);
                            }
                        }
                    } catch (err) {
                        console.error(`Failed to load dictionary: ${baseName}`, err);
                    }
                }
            }

            // Deduplicate vocabulary array
            this.masterVocabulary = [...new Set(this.masterVocabulary)];

        } catch (e) {
            console.error("Error loading dictionaries folder:", e);
        }
    }

    /**
     * Adds a word to personal dictionary with duplicate protection.
     */
    async addToPersonalDictionary(word: string) {
        const cleanWord = word.trim().toLowerCase();
        if (!cleanWord || this.personalWords.includes(cleanWord)) {
            return;
        }

        const adapter = this.app.vault.adapter;
        const personalDictPath = `${this.manifest.dir}/dicts/personal.txt`;

        let existing = "";
        if (await adapter.exists(personalDictPath)) {
            existing = await adapter.read(personalDictPath);
        }

        const updated = existing ? `${existing.trim()}\n${cleanWord}\n` : `${cleanWord}\n`;
        await adapter.write(personalDictPath, updated);

        this.personalWords.push(cleanWord);
        this.masterVocabulary.push(cleanWord);

        for (const sp of this.spellcheckers) {
            try {
                sp.add(cleanWord);
            } catch (e) {}
        }
    }

    /**
     * Removes a word from personal dictionary.
     */
    async removeFromPersonalDictionary(word: string) {
        const cleanWord = word.trim().toLowerCase();
        this.personalWords = this.personalWords.filter(w => w !== cleanWord);
        this.masterVocabulary = this.masterVocabulary.filter(w => w !== cleanWord);

        const adapter = this.app.vault.adapter;
        const personalDictPath = `${this.manifest.dir}/dicts/personal.txt`;
        const updated = this.personalWords.join('\n') + (this.personalWords.length > 0 ? '\n' : '');
        await adapter.write(personalDictPath, updated);

        await this.loadAllDictionaries();
    }
}

/**
 * Settings Tab with Built-in Library Downloader & Guarded Fuzzy Matching Controls
 */
class SpellCheckerSettingTab extends PluginSettingTab {
    plugin: OfflineSpellChecker;
    statusEl: HTMLElement | null = null;

    constructor(app: App, plugin: OfflineSpellChecker) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.addClass('sxjeel-settings');
        const hero = containerEl.createDiv({ cls: 'sxjeel-hero' });
        hero.createDiv({ cls: 'sxjeel-hero-title', text: 'Offline Spell Checker' });
        hero.createDiv({ cls: 'sxjeel-hero-sub', text: 'Fast, private spell checking with guarded fuzzy matching.' });

        // ==========================================
        // SECTION 1: GENERAL CONTROLS
        // ==========================================
        new Setting(containerEl).setName('General').setHeading();

        // Zero-lag instant toggle! Does NOT re-read or wipe dictionaries from RAM!
        new Setting(containerEl)
            .setName('Enable Spell Checker')
            .setDesc('Underline misspelled words as you type.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.isEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.isEnabled = value;
                    await this.plugin.saveSettings();
                    (this.app.workspace as any).updateOptions?.();
                    this.display();
                }));

        // Rule 7: off / normal / loose setting
        new Setting(containerEl)
            .setName('Fuzzy Matching Sensitivity')
            .setDesc('How many typos are tolerated when suggesting words.')
            .addDropdown(dd => dd
                .addOption('off', 'Off · exact and prefix only')
                .addOption('normal', 'Normal · guarded')
                .addOption('loose', 'Loose · one extra typo')
                .setValue(this.plugin.settings.fuzzyMode)
                .onChange(async (value: FuzzyMode) => {
                    this.plugin.settings.fuzzyMode = value;
                    await this.plugin.saveSettings();
                    new Notice(`Fuzzy matching set to: ${value.toUpperCase()}`);
                }));

        new Setting(containerEl)
            .setName('Suggest note titles')
            .setDesc('Include vault note titles in right-click suggestions.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeNotesInSuggestions)
                .onChange(async (value) => {
                    this.plugin.settings.includeNotesInSuggestions = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Accept prefix compounds')
            .setDesc('Treat words like "subsystem" or "multimodal" as correct.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.acceptPrefixCompounds)
                .onChange(async (value) => {
                    this.plugin.settings.acceptPrefixCompounds = value;
                    await this.plugin.saveSettings();
                    (this.app.workspace as any).updateOptions?.();
                }));

        // ==========================================
        // SECTION 2: FEATURED & DEFAULT LIBRARIES
        // ==========================================
        new Setting(containerEl).setName('Dictionaries').setHeading();

        // Featured Library Cards
        const featuredCard = containerEl.createDiv({ cls: 'dict-manager-card' });
        featuredCard.createDiv({ cls: 'dict-card-title', text: 'Quick install' });
        featuredCard.createDiv({ cls: 'dict-card-sub', text: 'One click to download and activate.' });

        const featuredButtonsContainer = featuredCard.createDiv({ cls: 'dict-featured-buttons' });

        const quickStatus = featuredCard.createDiv({ cls: 'dict-download-status' });

        const featuredLibraries = [
            { code: 'en-US', label: 'English (US)' },
            { code: 'en-IN', label: 'English (India)' },
            { code: 'en-med', label: 'English (Medical)' },
            { code: 'hi-IN', label: 'Hindi (India)' }
        ];

        for (const feat of featuredLibraries) {
            const btn = featuredButtonsContainer.createEl('button', {
                text: feat.label,
                cls: feat.code === 'en-US' ? 'mod-cta' : ''
            });

            btn.onclick = async () => {
                btn.disabled = true;
                quickStatus.setText(`Starting download for ${feat.label}...`);
                const dict = getDictionaryByCode(feat.code);
                if (dict) {
                    const res = await downloadDictionary(
                        this.app,
                        this.plugin.manifest.dir || '',
                        dict,
                        (msg) => quickStatus.setText(msg)
                    );
                    if (res.success) {
                        await this.plugin.loadAllDictionaries();
                        (this.app.workspace as any).updateOptions?.();
                        quickStatus.setText(res.message);
                        new Notice(res.message);
                        this.display();
                    } else {
                        quickStatus.setText(res.message);
                        new Notice(res.message);
                    }
                }
                btn.disabled = false;
            };
        }

        // Selectable Catalog Downloader (all 45+ international languages)
        const downloadSetting = new Setting(containerEl)
            .setName('More languages')
            .setDesc('Choose from 45+ dictionaries.');

        downloadSetting.addDropdown(dd => {
            DICTIONARY_CATALOG.forEach(dict => {
                const label = dict.name;
                dd.addOption(dict.code, label);
            });
            dd.setValue(this.plugin.settings.selectedCatalogCode);
            dd.onChange(async (val) => {
                this.plugin.settings.selectedCatalogCode = val;
                await this.plugin.saveSettings();
            });
        });

        this.statusEl = containerEl.createDiv({ cls: 'dict-download-status' });

        downloadSetting.addButton(btn => btn
            .setButtonText('Download')
            .setCta()
            .onClick(async () => {
                const code = this.plugin.settings.selectedCatalogCode;
                const dict = getDictionaryByCode(code);
                if (!dict) return;

                btn.setDisabled(true);
                if (this.statusEl) this.statusEl.setText(`Downloading ${dict.name}...`);

                const result = await downloadDictionary(
                    this.app,
                    this.plugin.manifest.dir || '',
                    dict,
                    (msg) => {
                        if (this.statusEl) this.statusEl.setText(msg);
                    }
                );

                if (result.success) {
                    await this.plugin.loadAllDictionaries();
                    (this.app.workspace as any).updateOptions?.();
                    if (this.statusEl) this.statusEl.setText(result.message);
                    new Notice(result.message);
                    this.display();
                } else {
                    if (this.statusEl) this.statusEl.setText(result.message);
                    new Notice(result.message);
                }
                btn.setDisabled(false);
            }));

        // ==========================================
        // SECTION 3: INSTALLED DICTIONARIES
        // ==========================================
        new Setting(containerEl).setName('Installed').setHeading();

        const installed = await getInstalledDictionaries(this.app, this.plugin.manifest.dir || '');

        if (installed.length === 0) {
            containerEl.createEl('p', {
                text: 'No dictionaries installed yet.', cls: 'dict-empty'
            });
        } else {
            const listContainer = containerEl.createDiv({ cls: 'dict-manager-card' });

            for (const dict of installed) {
                const row = listContainer.createDiv({ cls: 'installed-dict-row' });

                const info = row.createDiv({ cls: 'installed-dict-info' });
                info.createSpan({ cls: 'installed-dict-name', text: dict.name });
                const sizeKb = Math.round((dict.affSize + dict.dicSize) / 1024);
                info.createSpan({
                    cls: 'installed-dict-files',
                    text: `${dict.baseName}.aff + ${dict.baseName}.dic (${sizeKb} KB)`
                });

                const deleteBtn = row.createEl('button', {
                    text: 'Delete',
                    cls: 'mod-warning'
                });

                deleteBtn.onclick = async () => {
                    if (confirm(`Are you sure you want to delete the ${dict.name} dictionary?`)) {
                        await deleteDictionary(this.app, this.plugin.manifest.dir || '', dict.baseName);
                        await this.plugin.loadAllDictionaries();
                        (this.app.workspace as any).updateOptions?.();
                        new Notice(`Deleted ${dict.name}`);
                        this.display();
                    }
                };
            }
        }

        const currentlyLoadedStr = this.plugin.loadedDictNames.length > 0
            ? `Active: ${this.plugin.loadedDictNames.join(', ')} · ${this.plugin.masterVocabulary.length.toLocaleString()} words`
            : 'No dictionaries loaded.';
        containerEl.createDiv({ cls: 'dict-footnote', text: currentlyLoadedStr });

        // ==========================================
        // SECTION 4: PERSONAL DICTIONARY
        // ==========================================
        new Setting(containerEl).setName('Personal dictionary').setHeading();

        const addWordSetting = new Setting(containerEl)
            .setName('Add word')
            .setDesc(`${this.plugin.personalWords.length} custom word(s). Names, acronyms and terms that should never be flagged.`);

        let newWordInput = '';
        addWordSetting.addText(text => text
            .setPlaceholder('Word')
            .onChange(val => { newWordInput = val; }));

        addWordSetting.addButton(btn => btn
            .setButtonText('Add Word')
            .onClick(async () => {
                if (newWordInput && newWordInput.trim()) {
                    await this.plugin.addToPersonalDictionary(newWordInput);
                    new Notice(`Added "${newWordInput.trim()}" to dictionary`);
                    (this.app.workspace as any).updateOptions?.();
                    this.display();
                }
            }));

        if (this.plugin.personalWords.length > 0) {
            new Setting(containerEl)
                .setName('Manage words')
                .setDesc('View or remove custom words.')
                .addButton(btn => btn
                    .setButtonText('Manage')
                    .onClick(() => {
                        new PersonalWordsModal(this.app, this.plugin, () => this.display()).open();
                    }));
        }

        // ==========================================
        // SECTION 5: UTILITIES
        // ==========================================
        new Setting(containerEl).setName('Utilities').setHeading();

        new Setting(containerEl)
            .setName('Dictionary files')
            .setDesc('Open the dictionaries folder or reload them.')
            .addButton(btn => btn
                .setButtonText('Open folder')
                .onClick(async () => {
                    const adapter = this.plugin.app.vault.adapter;
                    if (adapter instanceof FileSystemAdapter) {
                        const fullPath = adapter.getFullPath(`${this.plugin.manifest.dir}/dicts`);
                        try {
                            const { shell } = require('electron');
                            shell.openPath(fullPath);
                        } catch (e) {
                            new Notice("Opening the folder directly is only supported on Desktop.");
                        }
                    }
                }))
            .addButton(btn => btn
                .setButtonText('Reload')
                .setCta()
                .onClick(async () => {
                    await this.plugin.loadAllDictionaries();
                    (this.app.workspace as any).updateOptions?.();
                    this.display();
                    new Notice("Dictionaries reloaded successfully!");
                }));
    }
}

/**
 * Modal to manage personal dictionary words.
 */
class PersonalWordsModal extends Modal {
    plugin: OfflineSpellChecker;
    onChanged: () => void;

    constructor(app: App, plugin: OfflineSpellChecker, onChanged: () => void) {
        super(app);
        this.plugin = plugin;
        this.onChanged = onChanged;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: 'Personal Dictionary Words' });

        if (this.plugin.personalWords.length === 0) {
            contentEl.createEl('p', { text: 'No personal words added yet.' });
            return;
        }

        const listContainer = contentEl.createDiv({
            cls: 'personal-words-list',
            attr: { style: 'max-height: 350px; overflow-y: auto; margin-bottom: 15px;' }
        });

        for (const word of this.plugin.personalWords) {
            const row = listContainer.createDiv({
                cls: 'installed-dict-row',
                attr: { style: 'padding: 4px 8px;' }
            });
            row.createSpan({ text: word, attr: { style: 'font-weight: 500;' } });

            const deleteBtn = row.createEl('button', {
                text: 'Remove',
                cls: 'mod-warning',
                attr: { style: 'padding: 2px 8px; font-size: 11px;' }
            });

            deleteBtn.onclick = async () => {
                await this.plugin.removeFromPersonalDictionary(word);
                this.onChanged();
                this.onOpen();
            };
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
