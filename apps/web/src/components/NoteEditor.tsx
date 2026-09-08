"use client";

import { markdown } from "@codemirror/lang-markdown";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { useEffect, useRef } from "react";

const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

// Underlines [[Title]] spans and lets Cmd/Ctrl+click follow them — plain click
// still just places the cursor, same convention Obsidian uses in edit mode so
// you can click into link text to fix a typo without navigating away.
function wikiLinks(onNavigate: (title: string) => void) {
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
          WIKI_LINK_PATTERN.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = WIKI_LINK_PATTERN.exec(text))) {
            const start = from + match.index;
            const end = start + match[0].length;
            builder.add(
              start,
              end,
              Decoration.mark({ class: "cm-wikilink", attributes: { "data-link-title": match[1].trim() } }),
            );
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
          const el = (event.target as HTMLElement).closest<HTMLElement>(".cm-wikilink");
          const title = el?.dataset.linkTitle;
          if (!title) return false;
          event.preventDefault();
          onNavigate(title);
          return true;
        },
      },
    },
  );
}

const theme = EditorView.theme({
  "&": {
    fontSize: "15px",
    fontFamily: "var(--font-body)",
    color: "var(--color-ink)",
    backgroundColor: "transparent",
  },
  ".cm-content": { padding: 0, caretColor: "var(--color-ink)" },
  ".cm-line": { padding: 0 },
  "&.cm-focused": { outline: "none" },
  ".cm-wikilink": {
    color: "var(--color-accent-ink)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
});

interface NoteEditorProps {
  initialValue: string;
  onChange: (content: string) => void;
  onNavigateLink: (title: string) => void;
  autoFocus?: boolean;
}

/**
 * Uncontrolled by design: mount once per note (parent passes `key={noteId}`
 * so switching notes remounts it) and let CodeMirror own the document after
 * that — syncing `value` back in on every keystroke would fight the editor
 * for cursor position.
 */
export function NoteEditor({ initialValue, onChange, onNavigateLink, autoFocus }: NoteEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onNavigateRef = useRef(onNavigateLink);
  onNavigateRef.current = onNavigateLink;

  useEffect(() => {
    if (!hostRef.current) return;

    const view = new EditorView({
      doc: initialValue,
      parent: hostRef.current,
      extensions: [
        minimalSetup,
        markdown(),
        EditorView.lineWrapping,
        wikiLinks((title) => onNavigateRef.current(title)),
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
