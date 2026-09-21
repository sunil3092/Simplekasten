import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-surface";

const BUTTON_VARIANTS = {
  primary: "bg-accent text-white shadow-sm hover:bg-accent-ink disabled:hover:bg-accent",
  secondary: "border-(length:--border-w) border-line bg-surface text-ink hover:border-accent/60 hover:bg-surface-2",
  ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
  danger: "border-(length:--border-w) border-danger/30 bg-danger-soft text-danger hover:border-danger/60",
} as const;

const BUTTON_SIZES = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5",
  md: "px-3.5 py-2 text-sm gap-2",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
}

export function Button({ variant = "secondary", size = "md", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${focusRing} ${className}`}
      {...props}
    />
  );
}

export function IconButton({ className = "", "aria-label": ariaLabel, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={ariaLabel}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink ${focusRing} ${className}`}
      {...props}
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border-(length:--border-w) border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-faint">
      {children}
    </kbd>
  );
}

export function Chip({
  active,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={`inline-flex items-center gap-1 rounded-full border-(length:--border-w) px-2.5 py-1 font-mono text-[11px] font-medium transition-colors duration-150 ${
        active ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-muted hover:border-ink-faint"
      } ${focusRing} ${className}`}
      {...props}
    />
  );
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border-(length:--border-w) border-line bg-surface-2 p-0.5 text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1 font-medium transition-colors duration-150 ${focusRing} ${
            value === opt.value ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function SaveStatusIndicator({ status }: { status: "idle" | "saving" | "saved" }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px] text-ink-faint">
      <span
        className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
          status === "saving" ? "animate-pulse bg-accent-2" : "bg-accent"
        }`}
      />
      <span>{status === "saving" ? "Saving…" : "Saved"}</span>
    </span>
  );
}

/** Small uppercase label above a group of controls or links. */
export function SectionHeading({
  icon,
  compact,
  className = "mb-3",
  children,
}: {
  icon?: ReactNode;
  compact?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <h3
      className={`flex items-center gap-1.5 font-mono font-medium text-ink-faint uppercase ${
        compact ? "text-[10px] tracking-wider" : "text-xs tracking-wide"
      } ${className}`}
    >
      {icon}
      {children}
    </h3>
  );
}

/** A note reference row: zettel id + title, dashed when the target doesn't exist yet. */
export function NoteLink({
  zettelId,
  title,
  unresolved,
  onClick,
}: {
  zettelId: string | null;
  title: string;
  unresolved?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-1.5 rounded-lg border-(length:--border-w) px-3 py-2 text-left text-sm transition-colors hover:border-accent/60 hover:shadow-sm ${
        unresolved ? "border-dashed border-line text-ink-faint" : "border-line bg-surface text-ink"
      }`}
    >
      {zettelId && <span className="font-mono text-[10px] text-ink-faint">{zettelId}</span>}
      <span className="truncate">{title}</span>
    </button>
  );
}

/** Centered dialog over a dimmed backdrop. Escape or a click outside closes it. */
export function Modal({
  onClose,
  topClass,
  label,
  children,
}: {
  onClose: () => void;
  /** Literal Tailwind top-padding class, e.g. "pt-[10vh]". */
  topClass: string;
  label?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className={`animate-fade-in fixed inset-0 z-50 flex items-start justify-center bg-ink/40 ${topClass} backdrop-blur-[2px]`}
      onMouseDown={onClose}
    >
      <div
        role={label ? "dialog" : undefined}
        aria-label={label}
        className="animate-fade-scale-in w-full max-w-lg overflow-hidden rounded-2xl border-(length:--border-w) border-line bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
