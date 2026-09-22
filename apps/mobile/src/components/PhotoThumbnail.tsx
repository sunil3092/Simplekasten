import { useEffect, useState } from "react";
import { COPY } from "@simplekasten/core";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/Icon";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

interface PhotoThumbnailProps {
  id: string;
  onRemove: () => void;
}

export function PhotoThumbnail({ id, onRemove }: PhotoThumbnailProps) {
  const { colors, shape } = useTheme();
  const frame = { borderWidth: shape.borderWidth, borderColor: colors.line, borderRadius: shape.radius };
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Rejects on a stale attachment id (manifest entry gone) — the loading
    // placeholder stays, which is the right fallback for a missing file.
    vault.getAttachmentFilePath(id).then(
      (path) => {
        if (!cancelled) setUri(path);
      },
      (err) => console.warn(`Couldn't resolve attachment ${id}:`, err),
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <View style={styles.wrap}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, frame]} />
      ) : (
        <View style={[styles.image, frame, { backgroundColor: colors.surface2 }]} />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={COPY.deleteAttachment}
        hitSlop={6}
        onPress={onRemove}
        style={[styles.remove, { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: shape.borderWidth, borderRadius: Math.min(shape.radius, 12) }]}
      >
        <Icon name="trash" size={13} color={colors.danger} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  image: { width: 96, height: 96 },
  remove: { position: "absolute", top: 4, right: 4, width: 26, height: 26, alignItems: "center", justifyContent: "center" },
});
