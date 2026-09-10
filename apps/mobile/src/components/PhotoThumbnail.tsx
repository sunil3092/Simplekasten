import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { attachmentFileUrl, authHeaders } from "@/lib/attachments";
import { useThemeColors } from "@/theme";

interface PhotoThumbnailProps {
  id: string;
  onRemove: () => void;
}

// react-native-web's Image renders a plain <img>, which can't send custom
// headers — and expo-image-picker's private files need the same Bearer auth
// as everything else. Fetching the bytes once and handing the Image a local
// blob: URI works identically on native and web, sidestepping that gap.
export function PhotoThumbnail({ id, onRemove }: PhotoThumbnailProps) {
  const colors = useThemeColors();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      const headers = await authHeaders();
      const res = await fetch(attachmentFileUrl(id), { headers });
      const blob = await res.blob();
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUri(objectUrl);
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
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
