import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuickSwitcher } from "./QuickSwitcher";

const RECENT = [
  { id: "n1", title: "Atomicity", zettelId: "1" },
  { id: "n2", title: "On writing systems", zettelId: "2" },
];

function renderSwitcher(overrides: Partial<React.ComponentProps<typeof QuickSwitcher>> = {}) {
  const onSearch = vi.fn().mockResolvedValue([]);
  const onSelect = vi.fn();
  const onCreate = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <QuickSwitcher
      recentNotes={RECENT}
      onSearch={onSearch}
      onSelect={onSelect}
      onCreate={onCreate}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { ...utils, onSearch, onSelect, onCreate, onClose };
}

describe("QuickSwitcher", () => {
  it("shows recent notes when the query is empty, without calling onSearch", () => {
    const { onSearch } = renderSwitcher();
    expect(screen.getByText("Atomicity")).toBeInTheDocument();
    expect(screen.getByText("On writing systems")).toBeInTheDocument();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("focuses the input on mount", () => {
    renderSwitcher();
    expect(screen.getByPlaceholderText(/search notes/i)).toHaveFocus();
  });

  it("calls onSearch (debounced) as the user types, and renders a highlighted snippet", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn().mockResolvedValue([
      { id: "n2", title: "On writing systems", zettelId: "2", snippet: "See Atomicity for details." },
    ]);
    renderSwitcher({ onSearch });

    await user.type(screen.getByPlaceholderText(/search notes/i), "atomic");

    await waitFor(() => expect(onSearch).toHaveBeenCalledWith("atomic"));
    await waitFor(() => expect(screen.getByText("Atomicity", { selector: "mark" })).toBeInTheDocument());
  });

  it("offers to create a new note when the query matches nothing exactly", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn().mockResolvedValue([]);
    renderSwitcher({ onSearch });

    await user.type(screen.getByPlaceholderText(/search notes/i), "Brand new title");
    await waitFor(() => expect(onSearch).toHaveBeenCalled());

    expect(screen.getByText(/create.*brand new title/i)).toBeInTheDocument();
  });

  it("does not offer to create a note when the query exactly matches an existing result", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn().mockResolvedValue([{ id: "n1", title: "Atomicity", zettelId: "1", snippet: "" }]);
    renderSwitcher({ onSearch });

    await user.type(screen.getByPlaceholderText(/search notes/i), "Atomicity");
    await waitFor(() => expect(onSearch).toHaveBeenCalled());

    expect(screen.queryByText(/create/i)).not.toBeInTheDocument();
  });

  it("selects the highlighted recent note and calls onSelect when Enter is pressed", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSwitcher();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("n1");
  });

  it("moves the selection down with ArrowDown before committing with Enter", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSwitcher();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledWith("n2");
  });

  it("calls onCreate with the typed title when Enter is pressed with no matches", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn().mockResolvedValue([]);
    const { onCreate } = renderSwitcher({ onSearch });

    await user.type(screen.getByPlaceholderText(/search notes/i), "Totally new");
    await waitFor(() => expect(onSearch).toHaveBeenCalled());
    await user.keyboard("{Enter}");

    expect(onCreate).toHaveBeenCalledWith("Totally new");
  });

  it("calls onClose when Escape is pressed", async () => {
    const user = userEvent.setup();
    const { onClose } = renderSwitcher();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("does not close when clicking inside the panel itself (e.g. the search input)", async () => {
    const user = userEvent.setup();
    const { onClose } = renderSwitcher();
    await user.click(screen.getByPlaceholderText(/search notes/i));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes when the backdrop outside the panel is clicked", async () => {
    const user = userEvent.setup();
    const { onClose, container } = renderSwitcher();
    // The outermost div is the full-screen backdrop; click it directly rather
    // than a descendant, so the click never reaches the panel's own handler.
    await user.click(container.firstElementChild as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });
});
