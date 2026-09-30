"use client";

import { useEffect, useState } from "react";
import { PlusIcon, TrashIcon, XIcon } from "./icons";
import { Button, IconButton, Modal, SectionHeading } from "./ui";

interface Template {
  id: string;
  name: string;
  content: string;
  isDefaultForDailyNote: boolean;
}

interface TemplatesModalProps {
  templates: Template[];
  onClose: () => void;
  onCreate: (input: { name: string; content: string }) => Promise<void>;
  onUpdate: (input: { id: string; name?: string; content?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSetDefaultForDailyNote: (id: string) => Promise<void>;
}

// "new" starts the create form; a template id edits that template; null
// shows the plain list.
type Editing = "new" | string | null;

export function TemplatesModal({ templates, onClose, onCreate, onUpdate, onDelete, onSetDefaultForDailyNote }: TemplatesModalProps) {
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (editing === "new") {
      setName("");
      setContent("");
    } else if (editing) {
      const t = templates.find((x) => x.id === editing);
      setName(t?.name ?? "");
      setContent(t?.content ?? "");
    }
  }, [editing, templates]);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (editing === "new") await onCreate({ name: trimmed, content });
    else if (editing) await onUpdate({ id: editing, name: trimmed, content });
    setEditing(null);
  }

  return (
    <Modal onClose={onClose} topClass="pt-[10vh]" label="Templates">
      <div className="flex items-center justify-between border-b-(length:--border-w) border-line px-5 py-3">
        <h2 className="font-display text-lg font-bold text-ink">Templates</h2>
        <IconButton aria-label="Close templates" onClick={onClose}>
          <XIcon />
        </IconButton>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
        {editing === null ? (
          <>
            <SectionHeading className="mb-2">
              {`Your templates`}
            </SectionHeading>
            {templates.length === 0 && <p className="mb-4 text-sm text-ink-faint">No templates yet.</p>}
            <ul className="mb-4 flex flex-col gap-1.5">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-lg border-(length:--border-w) border-line px-3 py-2">
                  <button className="flex-1 text-left text-sm text-ink" onClick={() => setEditing(t.id)}>
                    {t.name}
                    {t.isDefaultForDailyNote && <span className="ml-2 font-mono text-[10px] text-accent-ink">DAILY DEFAULT</span>}
                  </button>
                  {!t.isDefaultForDailyNote && (
                    <Button variant="ghost" size="sm" onClick={() => onSetDefaultForDailyNote(t.id)}>
                      Use for daily notes
                    </Button>
                  )}
                  <IconButton aria-label={`Delete ${t.name}`} title={`Delete ${t.name}`} onClick={() => onDelete(t.id)} className="hover:text-danger">
                    <TrashIcon />
                  </IconButton>
                </li>
              ))}
            </ul>
            <Button variant="primary" onClick={() => setEditing("new")}>
              <PlusIcon />
              New template
            </Button>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
              className="w-full rounded-lg border-(length:--border-w) border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              autoFocus
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Template content — use {{date}}, {{time}} or {{title}}"
              rows={10}
              className="w-full rounded-lg border-(length:--border-w) border-line bg-surface p-3 font-mono text-sm text-ink outline-none focus:border-accent"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={save} disabled={!name.trim()}>
                Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
