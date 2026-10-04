import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  builtInThemes,
  memphisTheme,
  resolveTheme,
  type Theme,
} from "@simplekasten/themes";
import { describe, expect, it, vi } from "vitest";
import { ThemeContext, type ThemeContextValue } from "../lib/ThemeProvider";
import { SettingsModal } from "./SettingsModal";

const sunset: Theme = { ...memphisTheme, id: "sunset", name: "Sunset" };

function renderModal(
  overrides: Partial<ThemeContextValue> = {},
  vault?: {
    path: string;
    onChoose: () => void;
    onShow: () => void;
    getSummary?: () => Promise<{ notes: number; canvases: number; templates: number }>;
    onPurge?: () => Promise<void>;
  },
) {
  const value: ThemeContextValue = {
    themes: [...builtInThemes, sunset],
    activeId: "classic",
    mode: "system",
    resolved: resolveTheme(builtInThemes[0], "light"),
    notice: null,
    setTheme: vi.fn(async () => {}),
    setMode: vi.fn(async () => {}),
    installFromFile: vi.fn(async () => ({
      ok: false as const,
      errors: [],
      canceled: true as const,
    })),
    installFromText: vi.fn(async () => ({ ok: true as const, theme: sunset })),
    remove: vi.fn(async () => {}),
    ...overrides,
  };
  const onClose = vi.fn();
  render(
    <ThemeContext.Provider value={value}>
      <SettingsModal onClose={onClose} vault={vault} />
    </ThemeContext.Provider>,
  );
  return { value, onClose };
}

describe("SettingsModal", () => {
  it("lists built-in and installed themes with the active one selected", () => {
    renderModal();
    expect(screen.getByRole("radio", { name: /classic/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /memphis/i })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /snowui/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /sunset/i })).toBeInTheDocument();
  });

  it("selects a theme", () => {
    const { value } = renderModal();
    fireEvent.click(screen.getByRole("radio", { name: /memphis/i }));
    expect(value.setTheme).toHaveBeenCalledWith("memphis");
  });

  it("changes the mode", () => {
    const { value } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: /^dark$/i }));
    expect(value.setMode).toHaveBeenCalledWith("dark");
  });

  it("only offers Remove for installed themes", () => {
    const { value } = renderModal();
    expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /remove sunset/i }));
    expect(value.remove).toHaveBeenCalledWith("sunset");
  });

  it("installs pasted JSON and shows validation errors inline", async () => {
    const { value } = renderModal({
      installFromText: vi.fn(async () => ({
        ok: false as const,
        errors: ["colors.light.accent: must be a #rgb or #rrggbb colour"],
      })),
    });
    fireEvent.click(screen.getByRole("button", { name: /paste json/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /theme json/i }), {
      target: { value: "{}" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^install$/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "colors.light.accent",
      ),
    );
    expect(value.installFromText).toHaveBeenCalledWith("{}");
  });

  it("shows the vault folder and lets it be changed or revealed", () => {
    const vault = { path: "C:\\Notes\\My Vault", onChoose: vi.fn(), onShow: vi.fn() };
    renderModal({}, vault);
    expect(screen.getByTestId("vault-path")).toHaveTextContent("C:\\Notes\\My Vault");
    fireEvent.click(screen.getByRole("button", { name: /choose vault folder/i }));
    expect(vault.onChoose).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /show vault location/i }));
    expect(vault.onShow).toHaveBeenCalledOnce();
  });

  describe("purging the vault", () => {
    function openPurge() {
      const vault = {
        path: "C:\\Notes\\My Vault",
        onChoose: vi.fn(),
        onShow: vi.fn(),
        getSummary: vi.fn(async () => ({ notes: 18, canvases: 1, templates: 0 })),
        onPurge: vi.fn(async () => {}),
      };
      const { onClose } = renderModal({}, vault);
      fireEvent.click(screen.getByRole("button", { name: /purge vault/i }));
      return { vault, onClose };
    }

    it("warns with what will be deleted before anything else", async () => {
      const { vault } = openPurge();
      const dialog = await screen.findByRole("dialog", { name: "Purge vault" });
      expect(dialog).toHaveTextContent('Purge "My Vault"?');
      expect(screen.getByTestId("purge-summary")).toHaveTextContent("18 notes");
      expect(screen.getByTestId("purge-summary")).toHaveTextContent("1 canvas");
      expect(screen.getByTestId("purge-summary")).toHaveTextContent("0 templates");
      expect(dialog).toHaveTextContent("cannot be undone");
      expect(vault.onPurge).not.toHaveBeenCalled();
    });

    it("needs the vault's name typed exactly before the purge button works", async () => {
      const { vault } = openPurge();
      fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
      const purge = screen.getByRole("button", { name: "Purge vault" });
      expect(purge).toBeDisabled();

      const input = screen.getByLabelText(/type the vault's name/i);
      fireEvent.change(input, { target: { value: "my vault" } });
      expect(purge).toBeDisabled();
      // Enter can't get past a wrong name either.
      fireEvent.submit(input.closest("form")!);
      expect(vault.onPurge).not.toHaveBeenCalled();

      fireEvent.change(input, { target: { value: "My Vault" } });
      expect(purge).toBeEnabled();
      fireEvent.click(purge);
      await waitFor(() => expect(vault.onPurge).toHaveBeenCalledOnce());
    });

    it("cancelling at either step deletes nothing and leaves Settings open", async () => {
      const { vault, onClose } = openPurge();
      const dialog = await screen.findByRole("dialog", { name: "Purge vault" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("dialog", { name: "Purge vault" })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /purge vault/i }));
      fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
      fireEvent.click(within(screen.getByRole("dialog", { name: "Purge vault" })).getByRole("button", { name: "Cancel" }));

      expect(vault.onPurge).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    });
  });

  it("credits the app icon's source, as its licence requires", () => {
    renderModal();
    expect(screen.getByTestId("credits")).toHaveTextContent("streamlinehq.com");
    expect(screen.getByTestId("credits")).toHaveTextContent("CC BY 4.0");
  });

  it("shows the fallback notice when present", () => {
    renderModal({
      notice: 'Theme "gone" could not be loaded, so Classic is being used.',
    });
    expect(screen.getByRole("status")).toHaveTextContent("could not be loaded");
  });

  it("closes on Escape", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
