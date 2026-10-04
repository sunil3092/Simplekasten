"use client";

import { autocompletion, closeBrackets, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { Prec, RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap, placeholder, tooltips, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { COPY } from "@simplekasten/core";
import { useEffect, useRef } from "react";

const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
// Mirrors packages/core/src/links.ts's extractHashtags — excludes markdown
// headings ("# Heading") by requiring a letter right after the `#`.
const HASHTAG_PATTERN = /(?<![#\w])#([a-zA-Z][\w/-]*)/g;

/**
 * Decorates every match of `pattern` with `className` and a `data-value`
 * attribute (the marked capture group), and lets Cmd/Ctrl+click on one fire
 * `onActivate` — plain click still just places the cursor, the same
 * convention Obsidian uses so you can fix a typo without navigating away.
 */
function clickableSpans(pattern: RegExp, className: string, onActivate: (value: string) => void) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.build(update.view);
        }
      }
      build(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        for (const { from, to } of view.visibleRanges) {
          const text = view.state.doc.sliceString(from, to);
          pattern.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = pattern.exec(text))) {
            const start = from + match.index;
            const end = start + match[0].length;
            builder.add(start, end, Decoration.mark({ class: className, attributes: { "data-value": match[1].trim() } }));
          }
        }
        return builder.finish();
      }
    },
    {
      decorations: (v) => v.decorations,
      eventHandlers: {
        mousedown(event, view) {
          if (!(event.metaKey || event.ctrlKey)) return false;
          const el = (event.target as HTMLElement).closest<HTMLElement>(`.${className}`);
          const value = el?.dataset.value;
          if (!value) return false;
          event.preventDefault();
          onActivate(value);
          return true;
        },
      },
    },
  );
}

/**
 * Suggests existing note titles while typing a `[[wiki-link]]`. Reads titles
 * from a ref (rather than closing over a fixed array) so the list stays
 * current as notes are created without needing to recreate the editor.
 */
function wikiLinkCompletionSource(titlesRef: { current: string[] }) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/\[\[([^\]|]*)$/);
    if (!match) return null;
    const from = match.from + 2;
    const query = match.text.slice(2).toLowerCase();
    const options = titlesRef.current
      .filter((title) => title.toLowerCase().includes(query))
      .slice(0, 20)
      .map((title) => ({
        label: title,
        type: "text",
        apply(view: EditorView, _completion: unknown, applyFrom: number, applyTo: number) {
          const hasClosing = view.state.doc.sliceString(applyTo, applyTo + 2) === "]]";
          const insert = hasClosing ? title : `${title}]]`;
          const cursor = applyFrom + insert.length + (hasClosing ? 2 : 0);
          view.dispatch({ changes: { from: applyFrom, to: applyTo, insert }, selection: { anchor: cursor } });
        },
      }));
    return { from, options };
  };
}

/**
 * Suggests the vault's existing tags while typing a `#hashtag`, so the same
 * tag gets reused instead of a near-duplicate being coined. Same ref trick as
 * the wiki-link source above.
 */
function hashtagCompletionSource(tagsRef: { current: string[] }) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/(?<![#\w])#[\w/-]*$/);
    if (!match) return null;
    const query = match.text.slice(1).toLowerCase();
    const options = tagsRef.current
      .filter((tag) => tag.toLowerCase().includes(query) && tag.toLowerCase() !== query)
      .slice(0, 20)
      .map((tag) => ({ label: tag, type: "keyword" }));
    return { from: match.from + 1, options, validFor: /^[\w/-]*$/ };
  };
}

const theme = EditorView.theme({
  "&": {
    fontSize: "15px",
    fontFamily: "var(--font-body)",
    color: "var(--color-ink)",
    backgroundColor: "transparent",
  },
  // Tall enough that an empty note still shows a clickable body area.
  ".cm-content": { padding: 0, minHeight: "240px", caretColor: "var(--color-ink)", cursor: "text" },
  // CodeMirror draws its own caret and selection, in colours meant for a
  // light page: a black caret that vanishes on a dark theme. Take both from
  // the active theme instead.
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-ink)", borderLeftWidth: "1.5px" },
  ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--color-accent) 30%, transparent)",
  },
  ".cm-placeholder": { color: "var(--color-ink-faint)" },
  ".cm-line": { padding: 0 },
  "&.cm-focused": { outline: "none" },
  ".cm-wikilink": {
    color: "var(--color-accent-ink)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  ".cm-hashtag": {
    color: "var(--color-accent-2)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": {
    border: "1px solid var(--color-line)",
    backgroundColor: "var(--color-surface)",
    borderRadius: "6px",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete ul li": {
    padding: "4px 10px",
    color: "var(--color-ink)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--color-accent-soft)",
    color: "var(--color-accent-ink)",
  },
});

// A small editor filling a fixed-size box (a flow card): it scrolls inside
// the box instead of growing the page.
const compactTheme = Prec.highest(
  EditorView.theme({
    "&": { fontSize: "12px", height: "100%" },
    ".cm-scroller": { overflow: "auto", lineHeight: "1.625", fontFamily: "var(--font-body)" },
    ".cm-content": { minHeight: "100%" },
  }),
);

interface NoteEditorProps {
  initialValue: string;
  onChange: (content: string) => void;
  onNavigateLink: (title: string) => void;
  onTagClick: (tag: string) => void;
  noteTitles: string[];
  /** Existing tags offered while typing a #hashtag. */
  tagNames?: string[];
  autoFocus?: boolean;
  /** Fill a fixed-size container rather than growing with the text. */
  compact?: boolean;
  /** Called when Up is pressed on the first line — lets the caller move to the title above. */
  onExitUp?: () => void;
}

/**
 * For the title field above an editor: Down or Enter moves the cursor into
 * the editor inside `scope`, so a note reads as one continuous thing to type
 * in rather than two boxes.
 */
export function moveToEditorOnKey(e: React.KeyboardEvent<HTMLInputElement>, scope: Element | null) {
  if (e.key !== "ArrowDown" && e.key !== "Enter") return;
  const editor = scope?.querySelector<HTMLElement>(".cm-content");
  if (!editor) return;
  e.preventDefault();
  editor.focus();
}

/**
 * Uncontrolled by design: mount once per note (parent passes `key={noteId}`
 * so switching notes remounts it) and let CodeMirror own the document after
 * that — syncing `value` back in on every keystroke would fight the editor
 * for cursor position.
 */
export function NoteEditor({ initialValue, onChange, onNavigateLink, onTagClick, noteTitles, tagNames = [], autoFocus, compact, onExitUp }: NoteEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onNavigateRef = useRef(onNavigateLink);
  onNavigateRef.current = onNavigateLink;
  const onTagClickRef = useRef(onTagClick);
  onTagClickRef.current = onTagClick;
  const noteTitlesRef = useRef(noteTitles);
  noteTitlesRef.current = noteTitles;
  const tagNamesRef = useRef(tagNames);
  tagNamesRef.current = tagNames;
  const onExitUpRef = useRef(onExitUp);
  onExitUpRef.current = onExitUp;

  useEffect(() => {
    if (!hostRef.current) return;

    const view = new EditorView({
      doc: initialValue,
      parent: hostRef.current,
      extensions: [
        // Up on the top line hands the cursor back to the title. Ahead of the
        // default keymap, but behind an open suggestion list, which uses Up itself.
        Prec.high(
          keymap.of([
            {
              key: "ArrowUp",
              run(view) {
                const exit = onExitUpRef.current;
                if (!exit) return false;
                const cursor = view.state.selection.main;
                if (!cursor.empty) return false;
                // "Top line" means the top line on screen: in a first paragraph that
                // wraps, Up still moves within it until the cursor reaches the top row.
                const here = view.coordsAtPos(cursor.head);
                const top = view.coordsAtPos(0);
                const onTopRow = here && top ? Math.abs(here.top - top.top) < 2 : view.state.doc.lineAt(cursor.head).number === 1;
                if (!onTopRow) return false;
                exit();
                return true;
              },
            },
          ]),
        ),
        minimalSetup,
        markdown(),
        EditorView.lineWrapping,
        placeholder(COPY.editorPlaceholder),
        closeBrackets(),
        autocompletion({ override: [wikiLinkCompletionSource(noteTitlesRef), hashtagCompletionSource(tagNamesRef)] }),
        // A compact editor sits inside a clipped, scaled card; its suggestion
        // list has to live on the page itself to be seen at all.
        ...(compact ? [tooltips({ parent: document.body, position: "fixed" }), compactTheme] : []),
        clickableSpans(WIKI_LINK_PATTERN, "cm-wikilink", (title) => onNavigateRef.current(title)),
        clickableSpans(HASHTAG_PATTERN, "cm-hashtag", (tag) => onTagClickRef.current(tag)),
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });
    if (autoFocus) view.focus();

    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className={compact ? "h-full" : "min-h-[200px] text-sm"} />;
}
