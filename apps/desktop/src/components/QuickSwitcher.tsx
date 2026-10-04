"use client";

import { COPY, type IconName } from "@simplekasten/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileTextIcon, Icon, PlusIcon, SearchIcon } from "./icons";
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

export interface CommandItem {
  id: string;
  icon: IconName;
  label: string;
  description: string;
  run: () => void;
}

interface QuickSwitcherProps {
  recentNotes: RecentItem[];
  onSearch: (query: string) => Promise<SearchResultItem[]>;
  onSelect: (id: string) => void;
  onCreate: (title: string) => void;
  onClose: () => void;
  /** Typing ">" as the first character switches from note search to this list. */
  commands?: CommandItem[];
}

// The engine wraps matches in \u0001...\u0002 sentinels (see searchNotes in local-engine) —
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
// already has muscle memory for. Searches full note content
// (local-engine searchNotes), not just titles; typing a title with no match and
// pressing Enter creates it, same as Obsidian's Quick Switcher.
export function QuickSwitcher({ recentNotes, onSearch, onSelect, onCreate, onClose, commands = [] }: QuickSwitcherProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => inputRef.current?.focus(), []);

  // Typing ">" switches this same input from "find a note" to "run a
  // command" — same mode-switch convention VS Code's and Obsidian's command
  // palettes use, so no new shortcut needs to be taught.
  const trimmed = query.trim();
  const commandMode = trimmed.startsWith(">");
  const commandQuery = commandMode ? trimmed.slice(1).trim().toLowerCase() : "";

  useEffect(() => {
    if (commandMode || !trimmed) {
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
  }, [trimmed, commandMode, onSearch]);

  const matchingCommands = useMemo(
    () => commands.filter((c) => c.label.toLowerCase().includes(commandQuery)),
    [commands, commandQuery],
  );

  const items = useMemo(() => {
    if (commandMode) return [];
    if (!trimmed) return recentNotes.slice(0, 20).map((n) => ({ ...n, snippet: undefined as string | undefined }));
    return results ?? [];
  }, [commandMode, trimmed, recentNotes, results]);

  const exactMatch = items.some((n) => n.title.toLowerCase() === trimmed.toLowerCase());

  useEffect(() => setActiveIndex(0), [query]);

  function commit() {
    if (commandMode) {
      matchingCommands[activeIndex]?.run();
      onClose();
      return;
    }
    if (items[activeIndex]) onSelect(items[activeIndex].id);
    else if (trimmed && !exactMatch) onCreate(trimmed);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const listLength = commandMode ? matchingCommands.length : items.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(listLength - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  return (
    <Modal onClose={onClose} topClass="pt-[15vh]" label="Quick switcher">
      <div className="flex items-center gap-2.5 border-b-(length:--border-w) border-line px-4 py-3">
        <span className="flex-none text-ink-faint">
          <SearchIcon width={18} height={18} />
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={COPY.searchPlaceholder}
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
        />
      </div>
      <ul className="max-h-96 overflow-y-auto py-1.5">
        {commandMode &&
          matchingCommands.map((c, i) => (
            <li key={c.id}>
              <button
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  c.run();
                  onClose();
                }}
                className={`flex w-full items-start gap-2.5 px-4 py-2 text-left transition-colors duration-100 ${
                  i === activeIndex ? "bg-accent-soft" : ""
                }`}
              >
                <Icon name={c.icon} className="mt-0.5 flex-none text-ink-faint" />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${i === activeIndex ? "text-accent-ink" : "text-ink"}`}>{c.label}</span>
                  <span className="block truncate text-xs text-ink-faint">{c.description}</span>
                </span>
              </button>
            </li>
          ))}
        {commandMode && matchingCommands.length === 0 && (
          <li className="px-4 py-3 text-sm text-ink-faint">No matching commands.</li>
        )}

        {!commandMode &&
          items.map((n, i) => (
            <li key={n.id}>
              <button
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => onSelect(n.id)}
                className={`flex w-full items-start gap-2.5 px-4 py-2 text-left transition-colors duration-100 ${
                  i === activeIndex ? "bg-accent-soft" : ""
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
        {!commandMode && trimmed && !exactMatch && (
          <li>
            <button
              onMouseEnter={() => setActiveIndex(items.length)}
              onClick={() => onCreate(trimmed)}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors duration-100 ${
                activeIndex === items.length ? "bg-accent-2-soft text-accent-2" : "text-ink-muted"
              }`}
            >
              <PlusIcon className="flex-none" />
              {COPY.createNote(trimmed)}
            </button>
          </li>
        )}
        {!commandMode && trimmed && results === null && <li className="px-4 py-3 text-sm text-ink-faint">{COPY.searching}</li>}
        {!commandMode && !trimmed && items.length === 0 && (
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
