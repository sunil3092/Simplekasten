import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { vault } from "@/lib/vault";
import { useThemeColors } from "@/theme";

interface PhotoThumbnailProps {
  id: string;
  onRemove: () => void;
}

export function PhotoThumbnail({ id, onRemove }: PhotoThumbnailProps) {
  const colors = useThemeColors();
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
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.loading, { backgroundColor: colors.surface2 }]} />
      )}
      <Pressable onPress={onRemove} style={[styles.remove, { backgroundColor: colors.surface }]}>
        <Text style={{ fontSize: 12, color: colors.inkMuted }}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  image: { width: 84, height: 84, borderRadius: 8 },
  loading: {},
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
