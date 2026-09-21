"use client";

import { RESERVED_THEME_IDS, resolveTheme, type ModePreference, type Theme } from "@simplekasten/themes";
import { useState } from "react";
import { useTheme } from "../lib/ThemeProvider";
import { XIcon } from "./icons";
import { Button, IconButton, Modal, SectionHeading, SegmentedControl } from "./ui";


function Swatch({ theme }: { theme: Theme }) {
  const colors = resolveTheme(theme, "light").colors;
  return (
    <span className="flex flex-none overflow-hidden rounded-md border-(length:--border-w) border-line" aria-hidden>
      {[colors.bg, colors.accent, colors.accent2].map((c) => (
        <span key={c} className="h-6 w-4" style={{ backgroundColor: c }} />
      ))}
    </span>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { themes, activeId, mode, notice, setTheme, setMode, installFromFile, installFromText, remove } = useTheme();
  const [pasting, setPasting] = useState(false);
  const [json, setJson] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  async function handleFile() {
    const outcome = await installFromFile();
    if (outcome.ok) setErrors([]);
    else if (!("canceled" in outcome && outcome.canceled)) setErrors(outcome.errors);
  }

  async function handlePaste() {
    const outcome = await installFromText(json);
    if (outcome.ok) {
      setErrors([]);
      setJson("");
      setPasting(false);
    } else {
      setErrors(outcome.errors);
    }
  }

  return (
    <Modal onClose={onClose} topClass="pt-[10vh]" label="Settings">
      <div className="flex items-center justify-between border-b-(length:--border-w) border-line px-5 py-3">
        <h2 className="font-display text-lg font-bold text-ink">Settings</h2>
        <IconButton aria-label="Close settings" onClick={onClose}>
          <XIcon />
        </IconButton>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
        <SectionHeading className="mb-2">Theme</SectionHeading>

        {notice && (
          <p role="status" className="mb-3 rounded-lg bg-accent-2-soft px-3 py-2 text-sm text-accent-2">
            {notice}
          </p>
        )}

        <ul className="mb-4 flex flex-col gap-1.5">
          {themes.map((theme) => {
            const builtIn = RESERVED_THEME_IDS.includes(theme.id);
            return (
              <li key={theme.id} className="flex items-center gap-2">
                <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border-(length:--border-w) border-line px-3 py-2 text-sm text-ink has-checked:border-accent has-checked:bg-accent-soft">
                  <input
                    type="radio"
                    name="theme"
                    className="accent-accent"
                    checked={activeId === theme.id}
                    onChange={() => setTheme(theme.id)}
                  />
                  <Swatch theme={theme} />
                  <span className="flex-1">{theme.name}</span>
                  <span className="font-mono text-[10px] text-ink-faint">{builtIn ? "built-in" : (theme.author ?? "installed")}</span>
                </label>
                {!builtIn && (
                  <Button variant="ghost" size="sm" aria-label={`Remove ${theme.name}`} onClick={() => remove(theme.id)}>
                    Remove
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

        <SectionHeading className="mb-2">Appearance</SectionHeading>
        <div className="mb-4">
          <SegmentedControl<ModePreference>
            value={mode}
            onChange={setMode}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </div>

        <SectionHeading className="mb-2">Install a theme</SectionHeading>
        <div className="flex gap-2">
          <Button onClick={handleFile}>Install theme…</Button>
          <Button variant="ghost" onClick={() => setPasting((p) => !p)}>
            Paste JSON
          </Button>
        </div>

        {pasting && (
          <div className="mt-3 flex flex-col gap-2">
            <textarea
              aria-label="Theme JSON"
              value={json}
              onChange={(e) => setJson(e.target.value)}
              rows={8}
              spellCheck={false}
              className="w-full rounded-lg border-(length:--border-w) border-line bg-surface p-2 font-mono text-xs text-ink outline-none focus:border-accent"
            />
            <div>
              <Button variant="primary" onClick={handlePaste}>
                Install
              </Button>
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <ul role="alert" className="mt-3 list-disc rounded-lg bg-danger-soft py-2 pr-3 pl-7 text-sm text-danger">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
