import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { attachmentFileUrl, authHeaders } from "@/lib/attachments";
import { useThemeColors } from "@/theme";

interface VoiceNotePlayerProps {
  id: string;
  onRemove: () => void;
}

export function VoiceNotePlayer({ id, onRemove }: VoiceNotePlayerProps) {
  const colors = useThemeColors();
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    authHeaders().then(setHeaders);
  }, []);

  const player = useAudioPlayer(headers ? { uri: attachmentFileUrl(id), headers } : null);
  const status = useAudioPlayerStatus(player);

  return (
    <View style={[styles.row, { borderColor: colors.line }]}>
      <Pressable
        onPress={() => (status.playing ? player.pause() : player.play())}
        disabled={!status.isLoaded}
        style={[styles.playButton, { backgroundColor: colors.accentSoft }]}
      >
        <Text style={{ color: colors.accentInk }}>{status.playing ? "⏸" : "▶"}</Text>
      </Pressable>
      <Text style={{ color: colors.inkMuted, fontSize: 13 }}>Voice note</Text>
      <Pressable onPress={onRemove} style={styles.remove}>
        <Text style={{ color: colors.inkFaint, fontSize: 13 }}>Remove</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  playButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  remove: { marginLeft: "auto" },
});
