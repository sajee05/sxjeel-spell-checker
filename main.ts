import { App, Notice, Plugin, PluginSettingTab, Setting, MarkdownView, Menu, Editor, FileSystemAdapter } from 'obsidian';
import { RangeSetBuilder, Extension, StateEffect, Text } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
// @ts-ignore
import nspell from 'nspell';

interface SpellCheckerSettings {
    isEnabled: boolean;
}

const DEFAULT_SETTINGS: SpellCheckerSettings = {
    isEnabled: true,
}

const spellcheckDecoration = Decoration.mark({ class: "sxjeel-misspelled" });
const refreshSpellcheckEffect = StateEffect.define<void>();
const wordPattern = /\b[a-zA-Z]+(?:['’][a-zA-Z]+)*\b/g;

function getDictionaryWord(word: string): string {
    return word.replace(/['’]s$/i, '');
}

function isCorrectWord(word: string, spellcheckers: any[]): boolean {
    const normalizedWord = word.replace(/’/g, "'");
    return spellcheckers.some(sp => sp.correct(normalizedWord));
}

function findWordAt(doc: Text, position: number): { from: number, to: number } | undefined {
    const line = doc.lineAt(position);
    const regex = new RegExp(wordPattern.source, wordPattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line.text)) !== null) {
        const from = line.from + match.index;
        const to = from + match[0].length;
        if (position >= from && position <= to) return { from, to };
    }
}

// Fast Levenshtein distance calculation for fuzzy matching
function getEditDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1  // deletion
                    )
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

export default class OfflineSpellChecker extends Plugin {
    settings: SpellCheckerSettings;
    spellcheckers: any[] = [];
    loadedDictNames: string[] = [];
    masterVocabulary: string[] = []; // Holds clean word lists for high speed fallback matching
    pluginExt: Extension;

    async onload() {
        await this.loadSettings();
        await this.initDictionaryFiles();
        await this.loadAllDictionaries();

        // 1. CodeMirror Extension for low resource live highlighting
        this.pluginExt = ViewPlugin.fromClass(
            class {
                decorations: DecorationSet;
                plugin: OfflineSpellChecker;

                constructor(view: EditorView) {
                    this.plugin = (window as any).sxjeelSpellCheckerPluginInstance;
                    this.decorations = this.buildDecorations(view);
                }

                update(update: ViewUpdate) {
                    const refreshRequested = update.transactions.some(transaction =>
                        transaction.effects.some(effect => effect.is(refreshSpellcheckEffect))
                    );
                    if (update.docChanged || update.viewportChanged || refreshRequested) {
                        this.decorations = this.buildDecorations(update.view);
                    }
                }

                buildDecorations(view: EditorView): DecorationSet {
                    const builder = new RangeSetBuilder<Decoration>();
                    if (!this.plugin || !this.plugin.settings.isEnabled || this.plugin.spellcheckers.length === 0) {
                        return builder.finish();
                    }

                    for (const { from, to } of view.visibleRanges) {
                        const text = view.state.doc.sliceString(from, to);
                        const wordRegex = new RegExp(wordPattern.source, wordPattern.flags);
                        let match;
                        while ((match = wordRegex.exec(text)) !== null) {
                            const word = match[0];
                            if (word.length > 1) {
                                const isCorrect = isCorrectWord(word, this.plugin.spellcheckers);
                                if (!isCorrect) {
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

        // 2. Right Click Context Menu 
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
                if (!this.settings.isEnabled || this.spellcheckers.length === 0) return;

                const cursor = editor.getCursor();
                const cm = (editor as any).cm;
                if (!cm || !cm.state) return;

                const pos = editor.posToOffset(cursor);
                const wordRange = findWordAt(cm.state.doc, pos);
                if (!wordRange) return;

                const word = cm.state.doc.sliceString(wordRange.from, wordRange.to);
                const fromPos = editor.offsetToPos(wordRange.from);
                const toPos = editor.offsetToPos(wordRange.to);

                if (word.length > 1) {
                    const isCorrect = isCorrectWord(word, this.spellcheckers);
                    
                    if (!isCorrect) {
                        menu.addSeparator();

                        const dictionaryWord = getDictionaryWord(word);
                        const suffix = word.slice(dictionaryWord.length);
                        let allSuggestions: string[] = [];
                        this.spellcheckers.forEach(sp => {
                            allSuggestions.push(...sp.suggest(dictionaryWord).map((suggestion: string) => `${suggestion}${suffix}`));
                        });

                        // FALLBACK FUZZY ENGINE: If native engine returns poor options or nothing, use Levenshtein calculation
                        if (allSuggestions.length < 3 && this.masterVocabulary.length > 0) {
                            const lowerWord = dictionaryWord.toLowerCase();
                            // Filter candidates of similar length to optimize lookup time down to milliseconds
                            const candidates = this.masterVocabulary.filter(w => Math.abs(w.length - lowerWord.length) <= 1);
                            
                            let fuzzyMatches: { word: string, score: number }[] = [];
                            for (const cand of candidates) {
                                const dist = getEditDistance(lowerWord, cand);
                                if (dist <= 2) { // Max 2 edits allowed
                                    fuzzyMatches.push({ word: cand, score: dist });
                                }
                            }
                            // Sort by closest match and pull top entries
                            fuzzyMatches.sort((a, b) => a.score - b.score);
                            const topFuzzy = fuzzyMatches.map(m => `${m.word}${suffix}`);
                            allSuggestions.push(...topFuzzy);
                        }

                        const uniqueSuggestions = [...new Set(allSuggestions)].slice(0, 5);

                        if (uniqueSuggestions.length === 0) {
                            menu.addItem((item) => {
                                item.setTitle("No suggestions found").setDisabled(true);
                            });
                        } else {
                            uniqueSuggestions.forEach((suggestion: string) => {
                                menu.addItem((item) => {
                                    item.setTitle(`Suggest: ${suggestion}`)
                                        .setIcon('check')
                                        .onClick(() => {
                                            editor.replaceRange(suggestion, fromPos, toPos);
                                            editor.setCursor(editor.offsetToPos(wordRange.from + suggestion.length));
                                        });
                                });
                            });
                        }

                        menu.addSeparator();
                        menu.addItem((item) => {
                            item.setTitle(`Add "${dictionaryWord}" to dictionary`)
                                .setIcon('plus-with-circle')
                                .onClick(async () => {
                                    await this.addToPersonalDictionary(dictionaryWord);
                                    this.refreshDecorations();
                                    new Notice(`Added "${dictionaryWord}" to dictionary`);
                                    view.editor.focus();
                                });
                        });
                    }
                }
            })
        );

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

    async loadAllDictionaries() {
        this.spellcheckers = [];
        this.loadedDictNames = [];
        this.masterVocabulary = [];
        
        if (!this.settings.isEnabled) return;

        const adapter = this.app.vault.adapter;
        const dictDir = `${this.manifest.dir}/dicts`;

        try {
            const files = await adapter.list(dictDir);
            const affFiles = files.files.filter(f => f.endsWith('.aff'));

            for (const affPath of affFiles) {
                const baseName = affPath.replace('.aff', '');
                const dicPath = `${baseName}.dic`;

                if (files.files.includes(dicPath)) {
                    try {
                        const affFile = await adapter.read(affPath);
                        const dicFile = await adapter.read(dicPath);
                        
                        const sp = nspell(affFile, dicFile);
                        this.spellcheckers.push(sp);
                        
                        const fileName = baseName.split('/').pop();
                        if (fileName) this.loadedDictNames.push(fileName);

                        // Parse out Hunspell layout formatting to compile the fallback vocabulary array
                        const lines = dicFile.split('\n');
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

            const personalDictPath = `${dictDir}/personal.txt`;
            if (await adapter.exists(personalDictPath)) {
                const personalWords = await adapter.read(personalDictPath);
                if (personalWords) {
                    this.spellcheckers.forEach(sp => sp.personal(personalWords));
                    
                    const personalLines = personalWords.split('\n');
                    for (let pWord of personalLines) {
                        pWord = pWord.trim();
                        if (pWord) {
                            this.spellcheckers.forEach(sp => sp.add(`${pWord}'s`));
                            this.masterVocabulary.push(pWord.toLowerCase());
                        }
                    }
                }
            }

            // Remove internal duplicates from the fallback array
            this.masterVocabulary = [...new Set(this.masterVocabulary)];

        } catch (e) {
            console.error("Error reading dictionaries folder", e);
        }
    }

    async addToPersonalDictionary(word: string) {
        if (this.spellcheckers.length === 0) return;
        
        const adapter = this.app.vault.adapter;
        const personalDictPath = `${this.manifest.dir}/dicts/personal.txt`;
        
        const existingWords = await adapter.read(personalDictPath);
        const newWords = existingWords ? `${existingWords}\n${word}` : word;
        
        await adapter.write(personalDictPath, newWords);
        
        this.spellcheckers.forEach(sp => {
            sp.add(word);
            sp.add(`${word}'s`);
        });
        this.masterVocabulary.push(word.toLowerCase());
    }

    refreshDecorations() {
        for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
            const editor = (leaf.view as MarkdownView).editor as (Editor & { cm?: EditorView }) | undefined;
            editor?.cm?.dispatch({ effects: refreshSpellcheckEffect.of(undefined) });
        }
    }
}

class SpellCheckerSettingTab extends PluginSettingTab {
    plugin: OfflineSpellChecker;

    constructor(app: App, plugin: OfflineSpellChecker) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Offline Spell Checker by sxjeel' });

        new Setting(containerEl)
            .setName('Enable Spell Checker')
            .setDesc('Toggle offline spell checking.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.isEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.isEnabled = value;
                    await this.plugin.saveSettings();
                    if (value) {
                        await this.plugin.loadAllDictionaries();
                    } else {
                        this.plugin.spellcheckers = [];
                        this.plugin.masterVocabulary = [];
                    }
                    this.plugin.app.workspace.updateOptions();
                    this.display(); 
                }));

        const loadedText = this.plugin.loadedDictNames.length > 0 
            ? `Currently Loaded: ${this.plugin.loadedDictNames.join(', ')} (${this.plugin.masterVocabulary.length.toLocaleString()} words indexed for fallback matching)` 
            : `No dictionaries loaded.`;

        new Setting(containerEl)
            .setName('Manage Dictionaries')
            .setDesc(`Drop any .dic and .aff files here. ${loadedText}`)
            .addButton(btn => btn
                .setButtonText('Open Folder')
                .onClick(async () => {
                    const adapter = this.plugin.app.vault.adapter;
                    if (adapter instanceof FileSystemAdapter) {
                        const fullPath = adapter.getFullPath(`${this.plugin.manifest.dir}/dicts`);
                        try {
                            const { shell } = require('electron');
                            shell.openPath(fullPath);
                        } catch (e) {
                            new Notice("Opening the folder directly is only supported on the Desktop app.");
                        }
                    }
                }))
            .addButton(btn => btn
                .setButtonText('Reload Files')
                .setCta()
                .onClick(async () => {
                    await this.plugin.loadAllDictionaries();
                    this.plugin.app.workspace.updateOptions();
                    this.display(); 
                    new Notice("Dictionaries reloaded!");
                }));
    }
}
