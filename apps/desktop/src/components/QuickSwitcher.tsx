"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileTextIcon, PlusIcon, SearchIcon } from "./icons";
import { Kbd, Modal } from "./ui";

interface RecentItem {
  id: string;
  title: string;
  zettelId: string;
}

interface SearchResultItem {
  id: string;
  title: string;
  zettelId: string;
  snippet: string;
}

interface QuickSwitcherProps {
  recentNotes: RecentItem[];
  onSearch: (query: string) => Promise<SearchResultItem[]>;
  onSelect: (id: string) => void;
  onCreate: (title: string) => void;
  onClose: () => void;
}

// ts_headline wraps matches in \u0001...\u0002 sentinels (see apps/api note.search) —
// split on those instead of dangerouslySetInnerHTML, since a snippet is built
// from the user's own note content and shouldn't be parsed as HTML.
function Snippet({ text }: { text: string }) {
  const parts = text.split(/[\u0001\u0002]/);
  return (
    <p className="mt-0.5 truncate text-xs text-ink-faint">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-accent-2-soft px-0.5 text-accent-2">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

// Ctrl/Cmd+K jump-or-search — the one shortcut every Obsidian and Logseq user
// already has muscle memory for. Searches full note content (via Postgres
// full-text search), not just titles; typing a title with no match and
// pressing Enter creates it, same as Obsidian's Quick Switcher.
export function QuickSwitcher({ recentNotes, onSearch, onSelect, onCreate, onClose }: QuickSwitcherProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      return;
    }
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      onSearch(trimmed).then((found) => {
        if (requestIdRef.current === requestId) setResults(found);
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const items = useMemo(() => {
    if (!query.trim()) return recentNotes.slice(0, 20).map((n) => ({ ...n, snippet: undefined as string | undefined }));
    return results ?? [];
  }, [query, recentNotes, results]);

  const exactMatch = items.some((n) => n.title.toLowerCase() === query.trim().toLowerCase());

  useEffect(() => setActiveIndex(0), [query]);

  function commit() {
    if (items[activeIndex]) onSelect(items[activeIndex].id);
    else if (query.trim() && !exactMatch) onCreate(query.trim());
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  return (
    <Modal onClose={onClose} topClass="pt-[15vh]">
      <div className="flex items-center gap-2.5 border-b-(length:--border-w) border-line px-4 py-3">
        <span className="flex-none text-ink-faint">
          <SearchIcon width={18} height={18} />
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search notes, or type a new title…"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
        />
      </div>
      <ul className="max-h-96 overflow-y-auto py-1.5">
        {items.map((n, i) => (
          <li key={n.id}>
            <button
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => onSelect(n.id)}
              className={`flex w-full items-start gap-2.5 border-l-2 px-4 py-2 text-left transition-colors duration-100 ${
                i === activeIndex ? "border-accent bg-accent-soft" : "border-transparent"
              }`}
            >
              <FileTextIcon className="mt-0.5 flex-none text-ink-faint" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2 text-sm">
                  <span className="font-mono text-[11px] text-ink-faint">{n.zettelId}</span>
                  <span className={`truncate ${i === activeIndex ? "text-accent-ink" : "text-ink"}`}>{n.title}</span>
                </span>
                {n.snippet && <Snippet text={n.snippet} />}
              </span>
            </button>
          </li>
        ))}
        {query.trim() && !exactMatch && (
          <li>
            <button
              onMouseEnter={() => setActiveIndex(items.length)}
              onClick={() => onCreate(query.trim())}
              className={`flex w-full items-center gap-2.5 border-l-2 px-4 py-2 text-left text-sm transition-colors duration-100 ${
                activeIndex === items.length ? "border-accent-2 bg-accent-2-soft text-accent-2" : "border-transparent text-ink-muted"
              }`}
            >
              <PlusIcon className="flex-none" />
              Create &ldquo;{query.trim()}&rdquo;
            </button>
          </li>
        )}
        {query.trim() && results === null && <li className="px-4 py-3 text-sm text-ink-faint">Searching…</li>}
        {!query.trim() && items.length === 0 && (
          <li className="px-4 py-3 text-sm text-ink-faint">No notes yet — type a title to create one.</li>
        )}
      </ul>
      <div className="flex items-center gap-3 border-t-(length:--border-w) border-line-soft px-4 py-2 text-[11px] text-ink-faint">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> navigate
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> select
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Kbd>esc</Kbd> close
        </span>
      </div>
    </Modal>
  );
}
