import { COPY, type IconName } from "@simplekasten/core";
import { noteTypeInfo, type FontKeyword } from "@simplekasten/themes";
import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { HardShadow } from "@/components/HardShadow";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/theme";

// Mobile's counterpart to apps/desktop/src/components/ui.tsx — same building
// blocks, same names, every border/radius/shadow from the theme's `shape` and
// every colour from its `colors`. Screens should reach for these rather than
// styling raw Pressables, so the two apps keep looking like one product.

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

/** Maps a theme font keyword to a React Native font family (undefined = system sans). */
export function fontFamily(keyword: FontKeyword): string | undefined {
  if (keyword === "mono") return MONO;
  if (keyword === "serif") return Platform.select({ ios: "Georgia", default: "serif" });
  return undefined;
}

/** Title/heading text style for the theme's display font. */
export function useDisplayText(): TextStyle {
  const { font, colors } = useTheme();
  return { fontFamily: fontFamily(font.display), fontWeight: "700", color: colors.ink };
}

/** Chips are pills under a rounded theme; a square theme (Memphis radius 0) applies as-is. */
function pillRadius(radius: number) {
  return radius >= 8 ? 999 : radius;
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  icon,
  label,
  onPress,
  disabled,
  compact,
  style,
  accessibilityLabel,
}: {
  variant?: ButtonVariant;
  icon?: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { colors, shape } = useTheme();
  const palette = {
    primary: { bg: colors.accent, fg: "#ffffff", border: colors.accent },
    secondary: { bg: colors.surface, fg: colors.ink, border: colors.line },
    ghost: { bg: "transparent", fg: colors.inkMuted, border: "transparent" },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.danger },
  }[variant];

  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === "ghost" ? 0 : shape.borderWidth,
          borderRadius: shape.radius,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon && <Icon name={icon} color={palette.fg} size={compact ? 14 : 16} />}
      <Text style={{ color: palette.fg, fontWeight: "600", fontSize: compact ? 13 : 15 }}>{label}</Text>
    </Pressable>
  );

  // Only the primary action carries the theme's hard shadow, as on desktop.
  return variant === "primary" ? <HardShadow style={style}>{button}</HardShadow> : <View style={style}>{button}</View>;
}

export function IconButton({ icon, label, onPress, color }: { icon: IconName; label: string; onPress: () => void; color?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon name={icon} size={20} color={color ?? colors.inkMuted} />
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const { colors, shape } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderWidth: shape.borderWidth,
          borderRadius: pillRadius(shape.radius),
          borderColor: active ? colors.accent : colors.line,
          backgroundColor: active ? colors.accentSoft : "transparent",
        },
      ]}
    >
      <Text style={{ fontFamily: MONO, fontSize: 11, color: active ? colors.accentInk : colors.inkMuted }}>{label}</Text>
    </Pressable>
  );
}

/** Small uppercase label above a group of controls or links. */
export function SectionHeading({ icon, children }: { icon?: IconName; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeading}>
      {icon && <Icon name={icon} size={13} color={colors.inkFaint} />}
      <Text style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 0.6, color: colors.inkFaint, textTransform: "uppercase" }}>{children}</Text>
    </View>
  );
}

/** A note reference row: zettel id + title, dashed when the target doesn't exist yet. */
export function NoteLink({ zettelId, title, unresolved, onPress }: { zettelId: string | null; title: string; unresolved?: boolean; onPress: () => void }) {
  const { colors, shape } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unresolved ? `${title} (not created yet)` : title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.noteLink,
        {
          borderWidth: shape.borderWidth,
          borderRadius: shape.radius,
          borderColor: pressed ? colors.accent : colors.line,
          borderStyle: unresolved ? "dashed" : "solid",
          backgroundColor: unresolved ? "transparent" : colors.surface,
        },
      ]}
    >
      {zettelId && <Text style={{ fontFamily: MONO, fontSize: 10, color: colors.inkFaint }}>{zettelId}</Text>}
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: unresolved ? colors.inkFaint : colors.ink }}>
        {title}
      </Text>
    </Pressable>
  );
}

/** Dashed placeholder box used for empty link/mention lists. */
export function EmptyHint({ children }: { children: string }) {
  const { colors, shape } = useTheme();
  return (
    <View style={[styles.emptyHint, { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line }]}>
      <Text style={{ color: colors.inkFaint, fontSize: 13, textAlign: "center" }}>{children}</Text>
    </View>
  );
}

export function SaveStatus({ status }: { status: "idle" | "saving" | "saved" }) {
  const { colors } = useTheme();
  return (
    <View style={styles.saveStatus}>
      <View style={[styles.saveDot, { backgroundColor: status === "saving" ? colors.accent2 : colors.accent }]} />
      <Text style={{ fontFamily: MONO, fontSize: 10, color: colors.inkFaint }}>{status === "saving" ? COPY.saving : COPY.saved}</Text>
    </View>
  );
}

export function SegmentedControl<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: { value: T; label: string }[] }) {
  const { colors, shape } = useTheme();
  return (
    <View style={[styles.segmented, { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line, backgroundColor: colors.surface2 }]}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, { borderRadius: Math.max(shape.radius - 2, 0), backgroundColor: selected ? colors.surface : "transparent" }]}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: selected ? colors.ink : colors.inkMuted }}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A note type badge — colours come from the shared NOTE_TYPES table. */
export function TypeBadge({ type, selected, onPress }: { type: string; selected: boolean; onPress: () => void }) {
  const { colors, shape } = useTheme();
  const info = noteTypeInfo(type);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={info.label}
      onPress={onPress}
      style={[
        styles.typeBadge,
        {
          borderWidth: shape.borderWidth,
          borderRadius: Math.min(shape.radius, 6),
          borderStyle: info.badge.dashed ? "dashed" : "solid",
          borderColor: selected ? colors[info.badge.border] : colors.lineSoft,
          backgroundColor: selected ? colors[info.badge.bg] : "transparent",
        },
      ]}
    >
      <Text style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.5, color: selected ? colors[info.badge.fg] : colors.inkFaint }}>
        {info.label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

/** Inline error message, e.g. a failed attachment. */
export function ErrorText({ children }: { children: string }) {
  const { colors, shape } = useTheme();
  return (
    <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: shape.radius }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 11 },
  buttonCompact: { paddingHorizontal: 10, paddingVertical: 7, gap: 6 },
  iconButton: { padding: 6 },
  chip: { paddingHorizontal: 9, paddingVertical: 4 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  noteLink: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  emptyHint: { borderStyle: "dashed", paddingHorizontal: 12, paddingVertical: 14 },
  saveStatus: { flexDirection: "row", alignItems: "center", gap: 5 },
  saveDot: { width: 6, height: 6, borderRadius: 3 },
  segmented: { flexDirection: "row", padding: 2 },
  segment: { paddingHorizontal: 12, paddingVertical: 5 },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 4 },
  error: { fontSize: 13, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10, overflow: "hidden" },
});
