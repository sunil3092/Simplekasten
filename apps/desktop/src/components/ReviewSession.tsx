"use client";

import { useEffect } from "react";
import type { ReviewRating } from "@simplekasten/local-engine";
import { CheckIcon, XIcon } from "./icons";
import { Button } from "./ui";

interface ReviewNote {
  id: string;
  zettelId: string;
  title: string;
  content: string;
}

interface ReviewSessionProps {
  note: ReviewNote | null;
  current: number;
  total: number;
  onRate: (rating: ReviewRating) => void;
  onClose: () => void;
}

// Reviewing isn't editing — the note is shown read-only, same reasoning
// GraphView gets a full screen instead of a dialog: this is the primary
// activity for as long as it's open.
export function ReviewSession({ note, current, total, onRate, onClose }: ReviewSessionProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-bg" data-testid="review-session">
      <div className="flex items-center justify-between border-b-(length:--border-w) border-line px-5 py-3">
        <h2 className="font-display text-lg font-bold text-ink">Review</h2>
        <div className="flex items-center gap-3">
          {note && (
            <span className="font-mono text-xs text-ink-faint">
              {current} of {total}
            </span>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border-(length:--border-w) border-line px-3 py-1.5 text-sm text-ink-muted transition-colors hover:border-accent/50 hover:text-ink"
          >
            <XIcon />
            Close
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-10 py-8">
        {note ? (
          <div className="w-full max-w-2xl">
            <div className="mb-6 rounded-2xl border-(length:--border-w) border-line bg-surface p-8">
              <div className="mb-3 font-mono text-xs text-ink-faint">{note.zettelId}</div>
              <h3 className="font-display mb-4 text-2xl font-bold text-ink">{note.title}</h3>
              <p className="whitespace-pre-wrap text-sm text-ink-muted">{note.content || "(empty note)"}</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Button variant="danger" onClick={() => onRate("again")}>
                Again
              </Button>
              <Button variant="secondary" onClick={() => onRate("hard")}>
                Hard
              </Button>
              <Button variant="secondary" onClick={() => onRate("good")}>
                Good
              </Button>
              <Button variant="primary" onClick={() => onRate("easy")}>
                Easy
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-faint">
              <CheckIcon width={26} height={26} />
            </div>
            <p className="text-sm text-ink-muted">You&apos;re all caught up.</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        )}
      </div>
    </div>
  );
}
