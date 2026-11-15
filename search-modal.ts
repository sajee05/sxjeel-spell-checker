import { App, SuggestModal, TFile, Notice, MarkdownView } from 'obsidian';
import { CandidateItem, findGuardedFuzzyMatches } from './fuzzy';
import type OfflineSpellChecker from './main';

export class GuardedFuzzySearchModal extends SuggestModal<CandidateItem> {
    plugin: OfflineSpellChecker;
    candidates: CandidateItem[] = [];

    constructor(app: App, plugin: OfflineSpellChecker) {
        super(app);
        this.plugin = plugin;
        this.setPlaceholder("Type search query (e.g. troubelshoot, Gitub, database, ai writing)...");
        this.buildCandidatePool();
    }

    buildCandidatePool(): void {
        this.candidates = [];

        // 1. Vault note titles and aliases
        const mdFiles = this.app.vault.getMarkdownFiles();
        for (const file of mdFiles) {
            const title = file.basename;
            this.candidates.push({
                text: title,
                category: 'title',
                source: file
            });

            // Check metadata aliases
            const fileCache = this.app.metadataCache.getFileCache(file);
            if (fileCache?.frontmatter?.aliases) {
                const aliases = Array.isArray(fileCache.frontmatter.aliases)
                    ? fileCache.frontmatter.aliases
                    : [fileCache.frontmatter.aliases];
                for (const alias of aliases) {
                    if (alias && typeof alias === 'string' && alias.trim()) {
                        this.candidates.push({
                            text: alias.trim(),
                            category: 'title',
                            source: file
                        });
                    }
                }
            }
        }

        // 2. Personal dictionary words
        for (const pWord of this.plugin.personalWords) {
            if (pWord.trim()) {
                this.candidates.push({
                    text: pWord.trim(),
                    category: 'personal'
                });
            }
        }

        // 3. Sample from master vocabulary (top words / relevant words)
        const sampleLimit = Math.min(this.plugin.masterVocabulary.length, 10000);
        for (let i = 0; i < sampleLimit; i++) {
            const w = this.plugin.masterVocabulary[i];
            if (w.length > 2) {
                this.candidates.push({
                    text: w,
                    category: 'dictionary'
                });
            }
        }
    }

    getSuggestions(query: string): CandidateItem[] {
        if (!query || !query.trim()) {
            return this.candidates.slice(0, 15);
        }

        return findGuardedFuzzyMatches(
            query,
            this.candidates,
            this.plugin.settings.fuzzyMode,
            25
        );
    }

    renderSuggestion(item: CandidateItem, el: HTMLElement): void {
        el.empty();
        el.addClass('guarded-fuzzy-item');

        const topRow = el.createDiv({ cls: 'guarded-fuzzy-top-row' });
        const titleEl = topRow.createSpan({ cls: 'guarded-fuzzy-title', text: item.text });

        const badgeEl = topRow.createSpan({ 
            cls: `guarded-fuzzy-badge badge-${item.category || 'dict'}`, 
            text: item.category ? item.category.toUpperCase() : 'DICT' 
        });

        if (item.matchReason) {
            const bottomRow = el.createDiv({ cls: 'guarded-fuzzy-bottom-row' });
            bottomRow.createSpan({ 
                cls: 'guarded-fuzzy-reason', 
                text: `${item.matchReason} (score: ${Math.round(item.score || 0)})` 
            });
        }
    }

    onChooseSuggestion(item: CandidateItem, evt: MouseEvent | KeyboardEvent): void {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

        // If it is a vault note and user didn't request insertion
        if (item.source instanceof TFile) {
            if (evt.shiftKey && activeView?.editor) {
                activeView.editor.replaceSelection(`[[${item.text}]]`);
                new Notice(`Inserted link: [[${item.text}]]`);
            } else {
                this.app.workspace.getLeaf(false).openFile(item.source);
            }
            return;
        }

        // If in editor, insert selected word/term
        if (activeView?.editor) {
            activeView.editor.replaceSelection(item.text);
            new Notice(`Inserted: ${item.text}`);
        } else {
            new Notice(`Selected: ${item.text}`);
        }
    }
}

