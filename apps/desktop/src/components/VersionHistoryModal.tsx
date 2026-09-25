"use client";

import { diffLines, type DiffLine } from "@simplekasten/local-engine";
import { useEffect, useState } from "react";
import { HistoryIcon, XIcon } from "./icons";
import { Button, ConfirmDialog, IconButton, Modal } from "./ui";

interface NoteVersion {
  id: string;
  createdAt: string;
  title: string;
}

interface VersionHistoryModalProps {
  noteId: string;
  currentContent: string;
  onClose: () => void;
  onListVersions: (noteId: string) => Promise<NoteVersion[]>;
  onGetVersion: (noteId: string, versionId: string) => Promise<{ title: string; content: string }>;
  onRestore: (noteId: string, versionId: string) => Promise<void>;
}

// A dialog, not a full-screen overlay like GraphView/ReviewSession — looking
// up an old version is an occasional lookup, not a primary mode to spend
// time in.
export function VersionHistoryModal({ noteId, currentContent, onClose, onListVersions, onGetVersion, onRestore }: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<NoteVersion[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [confirmingRestore, setConfirmingRestore] = useState(false);

  useEffect(() => {
    onListVersions(noteId).then((list) => {
      setVersions(list);
      if (list[0]) selectVersion(list[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  async function selectVersion(versionId: string) {
    setSelectedId(versionId);
    setSelectedContent(null);
    const snapshot = await onGetVersion(noteId, versionId);
    setSelectedContent(snapshot.content);
  }

  async function confirmRestore() {
    if (!selectedId) return;
    setConfirmingRestore(false);
    await onRestore(noteId, selectedId);
    onClose();
  }

  // Comparing the selected (older) version to the note's current content —
  // green lines were added since that snapshot, struck-through red lines
  // were removed since (so restoring would bring them back).
  const diff: DiffLine[] | null = selectedContent !== null ? diffLines(selectedContent, currentContent) : null;

  return (
    <Modal onClose={onClose} topClass="pt-[8vh]" label="Version history">
      <div className="flex items-center justify-between border-b-(length:--border-w) border-line px-5 py-3">
        <h2 className="font-display text-lg font-bold text-ink">Version history</h2>
        <IconButton aria-label="Close version history" onClick={onClose}>
          <XIcon />
        </IconButton>
      </div>

      <div className="flex h-[60vh]">
        <div className="w-52 flex-none overflow-y-auto border-r-(length:--border-w) border-line">
          {versions === null && <p className="px-4 py-3 text-sm text-ink-faint">Loading…</p>}
          {versions?.length === 0 && <p className="px-4 py-3 text-sm text-ink-faint">No earlier versions yet.</p>}
          <ul>
            {versions?.map((v) => (
              <li key={v.id}>
                <button
                  onClick={() => selectVersion(v.id)}
                  className={`block w-full px-4 py-2.5 text-left text-sm transition-colors ${
                    v.id === selectedId ? "bg-accent-soft text-accent-ink" : "text-ink hover:bg-surface-2"
                  }`}
                >
                  {new Date(v.createdAt).toLocaleString()}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden p-4">
          {diff === null ? (
            <p className="text-sm text-ink-faint">{versions?.length === 0 ? "" : "Loading…"}</p>
          ) : (
            <>
              <div className="mb-4 flex-1 overflow-y-auto rounded-lg border-(length:--border-w) border-line bg-surface p-3 font-mono text-xs leading-relaxed">
                {diff.length === 0 && <p className="text-ink-faint">No changes since this version.</p>}
                {diff.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.op === "insert"
                        ? "bg-accent-soft text-accent-ink"
                        : line.op === "delete"
                          ? "bg-danger-soft text-danger line-through"
                          : "text-ink-muted"
                    }
                  >
                    {line.op === "insert" ? "+ " : line.op === "delete" ? "- " : "  "}
                    {line.text || " "}
                  </div>
                ))}
              </div>
              <Button variant="primary" onClick={() => setConfirmingRestore(true)} disabled={!selectedId}>
                <HistoryIcon />
                Restore this version
              </Button>
            </>
          )}
        </div>
      </div>

      {confirmingRestore && (
        <ConfirmDialog
          title="Restore this version?"
          body="The note's current content will be replaced with this version's. Its current state is saved as a new version first, so this can be undone."
          confirmLabel="Restore"
          onConfirm={confirmRestore}
          onCancel={() => setConfirmingRestore(false)}
        />
      )}
    </Modal>
  );
}
