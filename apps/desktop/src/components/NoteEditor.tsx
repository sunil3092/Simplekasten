"use client";

import { autocompletion, closeBrackets, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, placeholder, ViewPlugin, type ViewUpdate } from "@codemirror/view";
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

const theme = EditorView.theme({
  "&": {
    fontSize: "15px",
    fontFamily: "var(--font-body)",
    color: "var(--color-ink)",
    backgroundColor: "transparent",
  },
  // Tall enough that an empty note still shows a clickable body area.
  ".cm-content": { padding: 0, minHeight: "240px", caretColor: "var(--color-ink)" },
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

interface NoteEditorProps {
  initialValue: string;
  onChange: (content: string) => void;
  onNavigateLink: (title: string) => void;
  onTagClick: (tag: string) => void;
  noteTitles: string[];
  autoFocus?: boolean;
}

/**
 * Uncontrolled by design: mount once per note (parent passes `key={noteId}`
 * so switching notes remounts it) and let CodeMirror own the document after
 * that — syncing `value` back in on every keystroke would fight the editor
 * for cursor position.
 */
export function NoteEditor({ initialValue, onChange, onNavigateLink, onTagClick, noteTitles, autoFocus }: NoteEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onNavigateRef = useRef(onNavigateLink);
  onNavigateRef.current = onNavigateLink;
  const onTagClickRef = useRef(onTagClick);
  onTagClickRef.current = onTagClick;
  const noteTitlesRef = useRef(noteTitles);
  noteTitlesRef.current = noteTitles;

  useEffect(() => {
    if (!hostRef.current) return;

    const view = new EditorView({
      doc: initialValue,
      parent: hostRef.current,
      extensions: [
        minimalSetup,
        markdown(),
        EditorView.lineWrapping,
        placeholder(COPY.editorPlaceholder),
        closeBrackets(),
        autocompletion({ override: [wikiLinkCompletionSource(noteTitlesRef)] }),
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

  return <div ref={hostRef} className="min-h-[200px] text-sm" />;
}
