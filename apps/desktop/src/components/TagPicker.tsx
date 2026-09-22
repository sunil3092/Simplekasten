"use client";

import { COPY, tagPickerState, toggleAssignedTag } from "@simplekasten/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, HashIcon, PlusIcon } from "./icons";

interface TagPickerProps {
  vaultTags: { name: string; noteCount: number }[];
  /** The note's assigned (frontmatter) tags. */
  assigned: string[];
  /** Every tag on the note, including #hashtags from its text. */
  onNote: string[];
  onChange: (assigned: string[]) => void;
}

/**
 * The note header's tag dropdown: assign existing tags, create new ones, or
 * unassign. Tags that only come from a #hashtag in the text are shown ticked
 * but locked — removing them means editing the text. The list logic lives in
 * @simplekasten/core (tagPickerState) so mobile's sheet behaves the same.
 */
export function TagPicker({ vaultTags, assigned, onNote, onChange }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const state = useMemo(() => tagPickerState({ vaultTags, assigned, onNote, query }), [vaultTags, assigned, onNote, query]);
  // The "Create" row is navigable like any other, after the existing tags.
  const itemCount = state.rows.length + (state.create ? 1 : 0);

  useEffect(() => setActiveIndex(0), [query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function toggle(name: string) {
    onChange(toggleAssignedTag(assigned, name));
    // Keep typing after a click, as you can after Enter.
    inputRef.current?.focus();
  }

  function create(name: string) {
    onChange(toggleAssignedTag(assigned, name));
    setQuery("");
  }

  function commit(index: number) {
    const row = state.rows[index];
    if (row) {
      if (!row.locked) toggle(row.name);
    } else if (state.create) {
      create(state.create);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(itemCount - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(activeIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={`flex items-center gap-1 rounded-md border-(length:--border-w) py-1 pr-1.5 pl-2 font-mono text-[10px] font-medium tracking-wide uppercase transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
          open ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface-2 text-ink-muted hover:border-accent/60"
        }`}
      >
        <HashIcon width={12} height={12} />
        {COPY.tags}
        {onNote.length > 0 && <span className="opacity-70">{onNote.length}</span>}
        <ChevronDownIcon className="opacity-60" />
      </button>

      {open && (
        <div
          className="animate-fade-scale-in absolute top-full left-0 z-40 mt-1.5 w-64 overflow-hidden rounded-xl border-(length:--border-w) border-line bg-surface shadow-lg"
          onKeyDown={onKeyDown}
        >
          <div className="border-b-(length:--border-w) border-line-soft px-3 py-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={COPY.tagSearchPlaceholder}
              aria-label={COPY.tagSearchPlaceholder}
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
          </div>
          <ul role="listbox" aria-label={COPY.tags} aria-multiselectable className="max-h-64 overflow-y-auto py-1">
            {state.rows.map((row, i) => (
              <li key={row.name} role="option" aria-selected={row.checked} aria-disabled={row.locked}>
                <button
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => !row.locked && toggle(row.name)}
                  title={row.locked ? COPY.tagFromTextHint : undefined}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors duration-100 ${
                    i === activeIndex ? "bg-accent-soft" : ""
                  } ${row.locked ? "cursor-default" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-3.5 w-3.5 flex-none items-center justify-center rounded-sm border-(length:--border-w) ${
                      row.checked ? "border-accent bg-accent text-white" : "border-line"
                    } ${row.locked ? "opacity-50" : ""}`}
                  >
                    {row.checked && <CheckIcon width={10} height={10} strokeWidth={3} />}
                  </span>
                  <span className={`min-w-0 flex-1 truncate font-mono text-xs ${i === activeIndex ? "text-accent-ink" : "text-ink"}`}>#{row.name}</span>
                  {row.locked ? (
                    <span className="font-mono text-[10px] text-ink-faint">{COPY.tagFromText}</span>
                  ) : (
                    <span className="font-mono text-[10px] text-ink-faint">{row.noteCount}</span>
                  )}
                </button>
              </li>
            ))}
            {state.create && (
              <li>
                <button
                  onMouseEnter={() => setActiveIndex(state.rows.length)}
                  onClick={() => create(state.create!)}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors duration-100 ${
                    activeIndex === state.rows.length ? "bg-accent-2-soft text-accent-2" : "text-ink-muted"
                  }`}
                >
                  <PlusIcon className="flex-none" />
                  {COPY.createTag(state.create)}
                </button>
              </li>
            )}
            {state.invalid && <li className="px-3 py-2 text-xs text-danger">{COPY.invalidTag}</li>}
            {!query.trim() && state.rows.length === 0 && <li className="px-3 py-2 text-xs text-ink-faint">{COPY.noTagsYet}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
