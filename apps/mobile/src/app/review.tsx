import type { NoteDetail, NoteListItem, ReviewRating } from "@simplekasten/local-engine";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, fontFamily } from "@/components/ui";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

const MONO = fontFamily("mono");

// "en-CA" renders as YYYY-MM-DD in the device's local time — same trick the
// vault tab's "Today" button and the note screen's daily-note paging use.
function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

// Pushed from the vault tab's Review button, not a tab itself — reviewing is
// a focused session, not a place to linger and browse. Presents one due note
// at a time, read-only (no editor: reviewing isn't editing), matching
// desktop's ReviewSession.
export default function ReviewScreen() {
  const { colors, shape } = useTheme();
  const router = useRouter();
  const [queue, setQueue] = useState<NoteListItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState<NoteDetail | null>(null);

  useFocusEffect(
    useCallback(() => {
      vault.listDueForReview(todayLocal()).then(async (due) => {
        setQueue(due);
        setIndex(0);
        setNote(due.length > 0 ? await vault.getNoteById(due[0].id) : null);
      });
    }, []),
  );

  async function rate(rating: ReviewRating) {
    if (!queue || !note) return;
    await vault.submitReview({ noteId: note.id, rating, today: todayLocal() });
    const nextIndex = index + 1;
    setIndex(nextIndex);
    setNote(nextIndex < queue.length ? await vault.getNoteById(queue[nextIndex].id) : null);
  }

  if (!queue) return <View style={[styles.container, { backgroundColor: colors.bg }]} />;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      {note ? (
        <>
          <Text style={{ fontFamily: MONO, fontSize: 12, color: colors.inkFaint, marginBottom: 10 }}>
            {Math.min(index + 1, queue.length)} of {queue.length}
          </Text>
          <View style={[styles.card, { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line, backgroundColor: colors.surface }]}>
            <Text style={{ fontFamily: MONO, fontSize: 11, color: colors.inkFaint, marginBottom: 8 }}>{note.zettelId}</Text>
            <Text style={[styles.title, { color: colors.ink }]}>{note.title}</Text>
            <Text style={{ fontSize: 15, lineHeight: 22, color: colors.inkMuted }}>{note.content || "(empty note)"}</Text>
          </View>
          <View style={styles.ratingRow}>
            <Button variant="danger" label="Again" onPress={() => rate("again")} style={styles.ratingButton} />
            <Button label="Hard" onPress={() => rate("hard")} style={styles.ratingButton} />
            <Button label="Good" onPress={() => rate("good")} style={styles.ratingButton} />
            <Button variant="primary" label="Easy" onPress={() => rate("easy")} style={styles.ratingButton} />
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={{ color: colors.inkMuted, fontSize: 15 }}>You&apos;re all caught up.</Text>
          <Button label="Close" onPress={() => router.back()} style={styles.closeButton} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, paddingBottom: 48 },
  card: { padding: 18, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  ratingRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ratingButton: { flexBasis: "47%", flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  closeButton: { marginTop: 16 },
});
