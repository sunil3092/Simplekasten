"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface Item {
  id: string;
  title: string;
  zettelId: string;
}

interface QuickSwitcherProps {
  notes: Item[];
  onSelect: (id: string) => void;
  onCreate: (title: string) => void;
  onClose: () => void;
}

// Ctrl/Cmd+K jump-to-anything — the one shortcut every Obsidian and Logseq
// user already has muscle memory for. Typing a title with no match and
// pressing Enter creates it, same as Obsidian's Quick Switcher.
export function QuickSwitcher({ notes, onSelect, onCreate, onClose }: QuickSwitcherProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(q));
  }, [notes, query]);

  const exactMatch = matches.some((n) => n.title.toLowerCase() === query.trim().toLowerCase());

  useEffect(() => setActiveIndex(0), [query]);

  function commit() {
    if (matches[activeIndex]) {
      onSelect(matches[activeIndex].id);
    } else if (query.trim() && !exactMatch) {
      onCreate(query.trim());
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[15vh]" onMouseDown={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-line bg-surface shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to a note, or type a new title…"
          className="w-full border-b border-line bg-transparent px-4 py-3 font-mono text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        <ul className="max-h-80 overflow-y-auto py-1">
          {matches.map((n, i) => (
            <li key={n.id}>
              <button
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => onSelect(n.id)}
                className={`flex w-full items-baseline gap-2 px-4 py-2 text-left text-sm ${
                  i === activeIndex ? "bg-accent-soft text-accent-ink" : "text-ink"
                }`}
              >
                <span className="font-mono text-[11px] text-ink-faint">{n.zettelId}</span>
                {n.title}
              </button>
            </li>
          ))}
          {query.trim() && !exactMatch && (
            <li>
              <button
                onMouseEnter={() => setActiveIndex(matches.length)}
                onClick={() => onCreate(query.trim())}
                className={`flex w-full items-baseline gap-2 px-4 py-2 text-left text-sm ${
                  activeIndex === matches.length ? "bg-accent-2-soft text-accent-2" : "text-ink-muted"
                }`}
              >
                <span className="font-mono text-[11px]">+ new</span>
                Create &ldquo;{query.trim()}&rdquo;
              </button>
            </li>
          )}
          {matches.length === 0 && !query.trim() && (
            <li className="px-4 py-3 text-sm text-ink-faint">No notes yet — type a title to create one.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
