"use client";

import { COPY } from "@simplekasten/core";
import { useState } from "react";
import { vaultClient } from "../lib/vaultClient";
import { Icon, XIcon } from "./icons";
import { IconButton, Modal, SectionHeading } from "./ui";

export interface AttachmentItem {
  id: string;
  kind: "photo" | "voice";
  filename: string;
}

/**
 * Photos and voice notes attached to a note — the same vault attachments
 * mobile records, so anything added on either device shows up on both.
 * Desktop can view, play, add (from a file) and remove; it doesn't record.
 */
export function Attachments({ attachments, onRemove }: { attachments: AttachmentItem[]; onRemove: (id: string) => void }) {
  const [viewing, setViewing] = useState<AttachmentItem | null>(null);
  const photos = attachments.filter((a) => a.kind === "photo");
  const voiceNotes = attachments.filter((a) => a.kind === "voice");
  if (attachments.length === 0) return null;

  return (
    <section className="mt-8" data-testid="attachments">
      <SectionHeading icon={<Icon name="paperclip" />}>
        {COPY.attachments} ({attachments.length})
      </SectionHeading>

      {photos.length > 0 && (
        <ul className="mb-3 grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
          {photos.map((a) => (
            <li key={a.id} className="group relative">
              <button
                onClick={() => setViewing(a)}
                className="block aspect-square w-full overflow-hidden rounded-lg border-(length:--border-w) border-line bg-surface-2 transition-shadow hover:shadow-sm"
              >
                <img src={vaultClient.attachmentUrl(a.id)} alt={a.filename} className="h-full w-full object-cover" />
              </button>
              <RemoveButton onClick={() => onRemove(a.id)} className="absolute top-1 right-1 bg-surface opacity-0 group-hover:opacity-100 focus-visible:opacity-100" />
            </li>
          ))}
        </ul>
      )}

      {voiceNotes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {voiceNotes.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border-(length:--border-w) border-line bg-surface px-3 py-2">
              <Icon name="mic" className="flex-none text-accent-2" />
              <audio controls preload="metadata" src={vaultClient.attachmentUrl(a.id)} className="h-8 min-w-0 flex-1" />
              <RemoveButton onClick={() => onRemove(a.id)} />
            </li>
          ))}
        </ul>
      )}

      {viewing && (
        <Modal onClose={() => setViewing(null)} topClass="pt-[8vh]" label={viewing.filename}>
          <div className="flex items-center justify-between border-b-(length:--border-w) border-line px-4 py-2.5">
            <span className="truncate font-mono text-xs text-ink-muted">{viewing.filename}</span>
            <IconButton aria-label="Close" onClick={() => setViewing(null)}>
              <XIcon />
            </IconButton>
          </div>
          <img src={vaultClient.attachmentUrl(viewing.id)} alt={viewing.filename} className="max-h-[70vh] w-full bg-surface-2 object-contain" />
        </Modal>
      )}
    </section>
  );
}

function RemoveButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <IconButton aria-label={COPY.deleteAttachment} title={COPY.deleteAttachment} onClick={onClick} className={`hover:text-danger ${className}`}>
      <Icon name="trash" />
    </IconButton>
  );
}
