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

interface VaultSummary {
  notes: number;
  canvases: number;
  templates: number;
}

interface VaultSettings {
  path: string;
  onChoose: () => void;
  onShow: () => void;
  /** What a purge would delete, counted when the user asks. */
  getSummary?: () => Promise<VaultSummary>;
  /** Permanently deletes the vault's contents. Only reachable through both confirmations below. */
  onPurge?: () => Promise<void>;
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Purging can't be undone, so it takes two deliberate steps: reading what
 * will be deleted, then typing the vault's name. Cancel is the focused button
 * on the first step and Enter does nothing until the name matches on the
 * second, so neither can be passed by reflex.
 */
function PurgeVaultDialog({
  vaultName,
  summary,
  onPurge,
  onCancel,
}: {
  vaultName: string;
  summary: VaultSummary;
  onPurge: () => Promise<void>;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"warn" | "type">("warn");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim() === vaultName;

  async function purge() {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onPurge();
    } catch {
      setError("The vault could not be purged. Nothing more was deleted; check the folder and try again.");
      setBusy(false);
    }
  }

  return (
    <Modal onClose={busy ? () => {} : onCancel} topClass="pt-[18vh]" label="Purge vault">
      <div className="px-5 pt-5 pb-4">
        <h2 className="font-display mb-2 text-lg font-bold text-danger">
          {step === "warn" ? `Purge "${vaultName}"?` : "Confirm the purge"}
        </h2>
        {step === "warn" ? (
          <div className="flex flex-col gap-2 text-sm text-ink-muted">
            <p>This permanently deletes everything in this vault:</p>
            <ul data-testid="purge-summary" className="list-disc pl-5 text-ink">
              <li>{count(summary.notes, "note")}, with their version history and attachments</li>
              <li>{count(summary.canvases, "canvas", "canvases")}</li>
              <li>{count(summary.templates, "template")}</li>
            </ul>
            <p>Installed themes and your settings are kept. Other files in the vault folder are not touched.</p>
            <p className="font-medium text-danger">This cannot be undone. There is no trash to restore from.</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              purge();
            }}
            className="flex flex-col gap-2 text-sm text-ink-muted"
          >
            <label htmlFor="purge-confirm">
              Type the vault&apos;s name, <span className="font-mono font-medium text-ink">{vaultName}</span>, to confirm.
            </label>
            <input
              id="purge-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              className="w-full rounded-lg border-(length:--border-w) border-line bg-surface px-3 py-2 font-mono text-sm text-ink outline-none focus:border-danger"
            />
            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-danger">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t-(length:--border-w) border-line-soft px-5 py-3">
        <Button variant="ghost" onClick={onCancel} disabled={busy} autoFocus={step === "warn"}>
          Cancel
        </Button>
        {step === "warn" ? (
          <Button variant="danger" onClick={() => setStep("type")}>
            Continue
          </Button>
        ) : (
          <Button variant="danger" onClick={purge} disabled={!matches || busy}>
            {busy ? "Purging…" : "Purge vault"}
          </Button>
        )}
      </div>
    </Modal>
  );
}

export function SettingsModal({ onClose, vault }: { onClose: () => void; vault?: VaultSettings }) {
  const { themes, activeId, mode, notice, setTheme, setMode, installFromFile, installFromText, remove } = useTheme();
  const [pasting, setPasting] = useState(false);
  const [json, setJson] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [purgeSummary, setPurgeSummary] = useState<VaultSummary | null>(null);
  const vaultName = vault?.path.split(/[\\/]/).filter(Boolean).pop() ?? "";

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
    // While the purge dialog is on top, Escape belongs to it, not to Settings.
    <Modal onClose={purgeSummary ? () => {} : onClose} topClass="pt-[10vh]" label="Settings">
      <div className="flex items-center justify-between border-b-(length:--border-w) border-line px-5 py-3">
        <h2 className="font-display text-lg font-bold text-ink">Settings</h2>
        <IconButton aria-label="Close settings" onClick={onClose}>
          <XIcon />
        </IconButton>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
        {vault && (
          <>
            <SectionHeading className="mb-2">Vault</SectionHeading>
            <p data-testid="vault-path" title={vault.path} className="mb-2 truncate font-mono text-xs text-ink-muted">
              {vault.path}
            </p>
            <div className="mb-5 flex gap-2">
              <Button onClick={vault.onChoose}>Choose vault folder…</Button>
              <Button variant="ghost" onClick={vault.onShow}>
                Show vault location
              </Button>
            </div>
            {/* On its own row, apart from the everyday actions, so it can't be hit by a near miss. */}
            {vault.getSummary && vault.onPurge && (
              <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border-(length:--border-w) border-danger/30 px-3 py-2.5">
                <p className="text-xs text-ink-muted">Permanently delete every note, canvas and template in this vault.</p>
                <Button variant="danger" className="flex-none" onClick={async () => setPurgeSummary(await vault.getSummary!())}>
                  Purge vault…
                </Button>
              </div>
            )}
          </>
        )}

        {vault?.onPurge && purgeSummary && (
          <PurgeVaultDialog
            vaultName={vaultName}
            summary={purgeSummary}
            onPurge={vault.onPurge}
            onCancel={() => setPurgeSummary(null)}
          />
        )}

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

        {/* Required by the icon's licence (CC BY 4.0) — see assets/icon/glyph.svg. */}
        <p data-testid="credits" className="mt-6 border-t border-line-soft pt-3 text-xs text-ink-faint">
          App icon from Streamline (streamlinehq.com), used under CC BY 4.0.
        </p>
      </div>
    </Modal>
  );
}
