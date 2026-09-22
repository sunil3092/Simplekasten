import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useState } from "react";
import { COPY } from "@simplekasten/core";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { IconButton } from "@/components/ui";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

function formatSeconds(total: number) {
  const s = Math.max(0, Math.floor(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface VoiceNotePlayerProps {
  id: string;
  onRemove: () => void;
}

export function VoiceNotePlayer({ id, onRemove }: VoiceNotePlayerProps) {
  const { colors, shape } = useTheme();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    // Rejects on a stale attachment id (manifest entry gone) — `uri` stays
    // null, which leaves the play button disabled rather than crashing.
    vault
      .getAttachmentFilePath(id)
      .then(setUri, (err) => console.warn(`Couldn't resolve attachment ${id}:`, err));
  }, [id]);

  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  return (
    <View style={[styles.row, { borderColor: colors.line, borderWidth: shape.borderWidth, borderRadius: shape.radius, backgroundColor: colors.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? "Pause voice note" : "Play voice note"}
        onPress={() => {
          // Replaying a finished clip needs a rewind first.
          if (!status.playing && status.duration > 0 && status.currentTime >= status.duration) player.seekTo(0);
          if (status.playing) player.pause();
          else player.play();
        }}
        disabled={!status.isLoaded}
        style={[styles.playButton, { backgroundColor: colors.accentSoft, borderColor: colors.accent, borderWidth: shape.borderWidth, borderRadius: shape.radius >= 8 ? 18 : shape.radius, opacity: status.isLoaded ? 1 : 0.5 }]}
      >
        <Icon name={status.playing ? "pause" : "play"} size={16} color={colors.accentInk} />
      </Pressable>
      <Icon name="mic" size={14} color={colors.accent2} />
      <Text style={{ color: colors.inkMuted, fontSize: 13 }}>
        Voice note{status.duration > 0 ? ` · ${formatSeconds(status.playing ? status.currentTime : status.duration)}` : ""}
      </Text>
      <View style={styles.remove}>
        <IconButton icon="trash" label={COPY.deleteAttachment} onPress={onRemove} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 6 },
  playButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  remove: { marginLeft: "auto" },
});
