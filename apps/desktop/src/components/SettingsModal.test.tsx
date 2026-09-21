import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { builtInThemes, memphisTheme, resolveTheme, type Theme } from "@simplekasten/themes";
import { describe, expect, it, vi } from "vitest";
import { ThemeContext, type ThemeContextValue } from "../lib/ThemeProvider";
import { SettingsModal } from "./SettingsModal";

const sunset: Theme = { ...memphisTheme, id: "sunset", name: "Sunset" };

function renderModal(overrides: Partial<ThemeContextValue> = {}) {
  const value: ThemeContextValue = {
    themes: [...builtInThemes, sunset],
    activeId: "memphis",
    mode: "system",
    resolved: resolveTheme(builtInThemes[0], "light"),
    notice: null,
    setTheme: vi.fn(async () => {}),
    setMode: vi.fn(async () => {}),
    installFromFile: vi.fn(async () => ({ ok: false as const, errors: [], canceled: true as const })),
    installFromText: vi.fn(async () => ({ ok: true as const, theme: sunset })),
    remove: vi.fn(async () => {}),
    ...overrides,
  };
  const onClose = vi.fn();
  render(
    <ThemeContext.Provider value={value}>
      <SettingsModal onClose={onClose} />
    </ThemeContext.Provider>,
  );
  return { value, onClose };
}

describe("SettingsModal", () => {
  it("lists built-in and installed themes with the active one selected", () => {
    renderModal();
    expect(screen.getByRole("radio", { name: /memphis/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /classic/i })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /sunset/i })).toBeInTheDocument();
  });

  it("selects a theme", () => {
    const { value } = renderModal();
    fireEvent.click(screen.getByRole("radio", { name: /classic/i }));
    expect(value.setTheme).toHaveBeenCalledWith("classic");
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
      installFromText: vi.fn(async () => ({ ok: false as const, errors: ["colors.light.accent: must be a #rgb or #rrggbb colour"] })),
    });
    fireEvent.click(screen.getByRole("button", { name: /paste json/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /theme json/i }), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: /^install$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("colors.light.accent"));
    expect(value.installFromText).toHaveBeenCalledWith("{}");
  });

  it("shows the fallback notice when present", () => {
    renderModal({ notice: 'Theme "gone" could not be loaded, so Memphis is being used.' });
    expect(screen.getByRole("status")).toHaveTextContent("could not be loaded");
  });

  it("closes on Escape", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
