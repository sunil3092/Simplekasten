import { COPY, createPendingSaver } from "@simplekasten/core";
import type { NoteDetail, NoteListItem } from "@simplekasten/local-engine";
import { NOTE_TYPES, type NoteTypeInfo } from "@simplekasten/themes";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NoteTextInput } from "@/components/NoteTextInput";
import { Button, ErrorText, fontFamily, useDisplayText } from "@/components/ui";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

type NoteType = NoteTypeInfo["value"];

const MONO = fontFamily("mono");
const SAVE_DEBOUNCE_MS = 600;
// How long the buttons stay off after an action. The vault answers faster
// than a double tap's second press, which would otherwise land on the note
// that just appeared. Same value as desktop's ReviewSession.
const SETTLE_MS = 350;
// What a fleeting note can become. Not "daily": a journal entry belongs to a
// date and is made from Today. Not "fleeting": that is what Skip means.
const SORT_TYPES = NOTE_TYPES.filter((t) => t.value !== "fleeting" && t.value !== "daily");

// Pushed from the vault tab's Review button, not a tab itself. Review is
// where fleeting notes get sorted: read one, rewrite it if it needs it, and
// say what it is — matching desktop's ReviewSession.
export default function ReviewScreen() {
  const { colors, shape } = useTheme();
  const displayText = useDisplayText();
  const router = useRouter();
  const [queue, setQueue] = useState<NoteListItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [failed, setFailed] = useState(false);
  // What the text field offers after [[ and #.
  const [allTitles, setAllTitles] = useState<{ id: string; title: string }[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  // One action at a time, and a moment's pause after each (see SETTLE_MS).
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (settleRef.current && clearTimeout(settleRef.current)), []);
  // Saves for the note go one after another, and every action waits for them
  // — see createPendingSaver for what goes wrong otherwise.
  const saver = useRef(createPendingSaver((pending: { id: string; title: string; content: string }) => vault.updateNote(pending))).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show(next: NoteDetail | null) {
    setNote(next);
    setTitle(next?.title ?? "");
    setContent(next?.content ?? "");
    setFailed(false);
  }

  // The list is fetched once per visit, so "N of M" stays put while notes
  // are sorted out of it.
  useFocusEffect(
    useCallback(() => {
      vault.listNotes().then(setAllTitles).catch(() => {});
      vault
        .listTags()
        .then((list) => setTags(list.map((t) => t.name)))
        .catch(() => {});
      vault.listReviewInbox().then(async (inbox) => {
        setQueue(inbox);
        setIndex(0);
        show(inbox.length > 0 ? await vault.getNoteById(inbox[0].id) : null);
      });
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function flush() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    await saver.flush();
  }

  // Leaving within the debounce would otherwise drop the last edit.
  useEffect(() => () => void flush().catch(() => {}), []); // eslint-disable-line react-hooks/exhaustive-deps

  function edit(next: { title: string; content: string }) {
    if (!note) return;
    saver.set({ id: note.id, ...next });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush().catch(() => setFailed(true)), SAVE_DEBOUNCE_MS);
  }

  async function advance() {
    if (!queue) return;
    const nextIndex = index + 1;
    setIndex(nextIndex);
    show(nextIndex < queue.length ? await vault.getNoteById(queue[nextIndex].id) : null);
  }

  async function act(action: () => Promise<unknown>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await flush();
      await action();
      await advance();
    } catch {
      setFailed(true);
    } finally {
      settleRef.current = setTimeout(() => {
        busyRef.current = false;
        setBusy(false);
      }, SETTLE_MS);
    }
  }

  function confirmDelete() {
    if (!note) return;
    const id = note.id;
    Alert.alert(COPY.deleteNoteTitle, COPY.deleteNoteBody(title), [
      { text: "Cancel", style: "cancel" },
      {
        text: COPY.reviewDelete,
        style: "destructive",
        onPress: () => {
          // The note is going; an edit waiting to be saved must not land after it.
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = null;
          saver.clear();
          void act(() => vault.deleteNote(id));
        },
      },
    ]);
  }

  const titles = allTitles.filter((n) => n.id !== note?.id).map((n) => n.title);

  if (!queue) return <View style={[styles.container, { backgroundColor: colors.bg }]} />;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {note ? (
        <>
          <Text style={{ fontFamily: MONO, fontSize: 12, color: colors.inkFaint, marginBottom: 10 }}>
            {COPY.reviewProgress(Math.min(index + 1, queue.length), queue.length)}
          </Text>
          <View style={[styles.card, { borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line, backgroundColor: colors.surface }]}>
            <Text style={{ fontFamily: MONO, fontSize: 11, color: colors.inkFaint, marginBottom: 8 }}>{note.zettelId}</Text>
            {/* Keyed by note, and locked while an action is on its way, so a
                keystroke can never be saved against the note that is leaving. */}
            <TextInput
              key={`title-${note.id}`}
              accessibilityLabel="Title"
              editable={!busy}
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                edit({ title: value, content });
              }}
              placeholder={COPY.titlePlaceholder}
              placeholderTextColor={colors.inkFaint}
              style={[styles.title, displayText, { color: colors.ink }]}
            />
            <NoteTextInput
              key={`text-${note.id}`}
              editable={!busy}
              value={content}
              onChangeText={(value) => {
                setContent(value);
                edit({ title, content: value });
              }}
              titles={titles}
              tags={tags}
              style={[styles.content, { color: colors.ink }]}
            />
          </View>
          {failed && <ErrorText>{COPY.reviewActionFailed}</ErrorText>}
          <View style={styles.actionRow}>
            {SORT_TYPES.map((t) => (
              <Button
                key={t.value}
                variant={t.value === "permanent" ? "primary" : "secondary"}
                label={t.label}
                disabled={busy}
                onPress={() => act(() => vault.updateNote({ id: note.id, type: t.value as NoteType }))}
                style={styles.actionButton}
              />
            ))}
            <Button label={COPY.reviewSkip} disabled={busy} onPress={() => act(async () => {})} style={styles.actionButton} />
            <Button variant="danger" label={COPY.reviewDelete} disabled={busy} onPress={confirmDelete} style={styles.actionButton} />
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={{ color: colors.inkMuted, fontSize: 15 }}>{COPY.reviewCaughtUp}</Text>
          <Button label={COPY.reviewClose} onPress={() => router.back()} style={styles.closeButton} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, paddingBottom: 48 },
  card: { padding: 18, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12, padding: 0 },
  content: { fontSize: 15, lineHeight: 22, minHeight: 160, padding: 0 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  actionButton: { flexBasis: "30%", flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  closeButton: { marginTop: 16 },
});
