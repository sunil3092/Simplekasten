import { COPY } from "@simplekasten/core";
import type { NoteDetail, NoteListItem } from "@simplekasten/local-engine";
import { NOTE_TYPES, type NoteTypeInfo } from "@simplekasten/themes";
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, View, type NativeSyntheticEvent, type TextInputSelectionChangeEventData } from "react-native";
import { PhotoThumbnail } from "@/components/PhotoThumbnail";
import { Button, Chip, EmptyHint, ErrorText, fontFamily, IconButton, NoteLink, SaveStatus, SectionHeading, TypeBadge, useDisplayText } from "@/components/ui";
import { VoiceNotePlayer } from "@/components/VoiceNotePlayer";
import { setLastNote } from "@/lib/lastNote";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

type NoteType = NoteTypeInfo["value"];

// Mirrors desktop NoteEditor's wikiLinkCompletionSource: an open `[[` with no
// closing bracket or alias yet, right before the cursor.
const OPEN_LINK = /\[\[([^\]|]*)$/;

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const displayText = useDisplayText();
  const router = useRouter();
  const navigation = useNavigation();

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [allNotes, setAllNotes] = useState<NoteListItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<NoteType>("fleeting");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  // Only set right after a suggestion is applied, to move the cursor past the
  // inserted title; otherwise the input owns its cursor (a fully controlled
  // selection makes Android's cursor jump while typing).
  const [forcedSelection, setForcedSelection] = useState<{ start: number; end: number } | undefined>(undefined);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [recording, setRecording] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ title: string; content: string; type: NoteType } | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    // A deep link to a deleted note resolves to null — leave `note` null so
    // the screen renders nothing instead of crashing.
    vault.getNoteById(id).then((detail) => {
      if (!detail) return;
      setNote(detail);
      setTitle(detail.title);
      setContent(detail.content);
      setType(detail.type);
      setStatus("saved");
    });
  }, [id]);

  // Coming back to this screen (from a linked note, or the graph) can find
  // its links stale — a note it pointed at may have just been created — so
  // derived fields and the title list are refetched on every focus. Title
  // and content aren't, so an in-progress edit is never overwritten.
  useFocusEffect(
    useCallback(() => {
      setLastNote(id);
      vault.listNotes().then(setAllNotes).catch(() => {});
      vault.getNoteById(id).then((fresh) => {
        if (fresh) setNote(fresh);
      });
    }, [id]),
  );

  async function flushPending() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) await vault.updateNote({ id, ...pending });
  }

  // Leaving within the 600 ms debounce would otherwise drop the last edit.
  useEffect(() => () => void flushPending(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function confirmDelete() {
    Alert.alert(COPY.deleteNoteTitle, COPY.deleteNoteBody(title), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (timerRef.current) clearTimeout(timerRef.current);
          pendingRef.current = null;
          await vault.deleteNote(id);
          setLastNote(null);
          router.back();
        },
      },
    ]);
  }

  function shiftDate(date: string, days: number): string {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  }

  // Replaces rather than pushes: paging through days is a "scroll through
  // the journal" gesture, not "drill into a link" — pushing would leave an
  // ever-growing back stack of one entry per day visited.
  async function openDailyOffset(days: number) {
    if (!note?.noteDate) return;
    await flushPending();
    const target = await vault.getOrCreateDailyNote(shiftDate(note.noteDate, days));
    router.replace(`/vault/${target.id}`);
  }

  useEffect(() => {
    navigation.setOptions({
      title: title || COPY.titlePlaceholder,
      headerRight: () =>
        note?.type === "daily" ? (
          <View style={{ flexDirection: "row", gap: 4 }}>
            <IconButton icon="chevronLeft" label="Previous day" onPress={() => openDailyOffset(-1)} />
            <IconButton icon="chevronRight" label="Next day" onPress={() => openDailyOffset(1)} />
            <IconButton icon="trash" label="Delete note" onPress={confirmDelete} />
          </View>
        ) : (
          <IconButton icon="trash" label="Delete note" onPress={confirmDelete} />
        ),
    });
  }); // re-bind every render so the delete handler sees the current title

  async function refreshNote() {
    const fresh = await vault.getNoteById(id);
    if (fresh) setNote(fresh);
  }

  function scheduleSave(next: { title: string; content: string; type: NoteType }) {
    pendingRef.current = next;
    setStatus("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (!pending) return;
      setStatus("saving");
      await vault.updateNote({ id, ...pending });
      await refreshNote();
      setStatus("saved");
    }, 600);
  }

  function onTitleChange(value: string) {
    setTitle(value);
    scheduleSave({ title: value, content, type });
  }

  function onContentChange(value: string) {
    setContent(value);
    scheduleSave({ title, content: value, type });
  }

  function onTypeChange(value: NoteType) {
    setType(value);
    scheduleSave({ title, content, type: value });
  }

  // ---- [[ link suggestions ------------------------------------------------
  const beforeCursor = content.slice(0, selection.start);
  const openLink = selection.start === selection.end ? OPEN_LINK.exec(beforeCursor) : null;
  const suggestions = openLink
    ? allNotes
        .filter((n) => n.id !== id && n.title.toLowerCase().includes(openLink[1].toLowerCase()))
        .slice(0, 8)
    : [];

  function applySuggestion(suggestion: string) {
    if (!openLink) return;
    const from = selection.start - openLink[1].length;
    const after = content.slice(selection.start);
    const hasClosing = after.startsWith("]]");
    const insert = hasClosing ? suggestion : `${suggestion}]]`;
    const next = content.slice(0, from) + insert + after;
    const cursor = from + insert.length + (hasClosing ? 2 : 0);
    setContent(next);
    setSelection({ start: cursor, end: cursor });
    setForcedSelection({ start: cursor, end: cursor });
    scheduleSave({ title, content: next, type });
  }

  // ---- Links ---------------------------------------------------------------
  async function openLinkedTitle(linkTitle: string, noteId: string | null) {
    await flushPending();
    if (noteId) {
      router.push(`/vault/${noteId}`);
      return;
    }
    // Unresolved link: create the note it points at, same as desktop.
    const created = await vault.createNote({ title: linkTitle, content: "", type: "fleeting" });
    router.push(`/vault/${created.id}`);
  }

  async function filterByTag(name: string) {
    await flushPending();
    router.navigate({ pathname: "/", params: { tag: name } });
  }

  // ---- Attachments -----------------------------------------------------------
  async function pickAndUploadPhoto(source: "camera" | "library") {
    setAttachmentError(null);
    try {
      const permission =
        source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setAttachmentError("Permission was denied.");
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setUploadingPhoto(true);
      await vault.createAttachment({
        noteId: id,
        sourcePath: asset.uri,
        filename: asset.fileName ?? `photo-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
      await refreshNote();
    } catch {
      // The camera in particular has no meaningful implementation in a
      // desktop browser — fail into an inline message rather than a crash.
      setAttachmentError(source === "camera" ? "Camera isn't available here — try Photo library." : "Couldn't attach that photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    await vault.deleteAttachment(attachmentId);
    await refreshNote();
  }

  async function toggleRecording() {
    setAttachmentError(null);
    if (recording) {
      await recorder.stop();
      setRecording(false);
      if (recorder.uri) {
        try {
          await vault.createAttachment({ noteId: id, sourcePath: recorder.uri, filename: `voice-${Date.now()}.m4a`, mimeType: "audio/m4a" });
          await refreshNote();
        } catch {
          setAttachmentError("Couldn't save that voice note.");
        }
      }
      return;
    }

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setAttachmentError("Microphone permission was denied.");
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch {
      setAttachmentError("Couldn't start recording.");
    }
  }

  if (!note) return null;

  const photos = note.attachments.filter((a) => a.kind === "photo");
  const voiceNotes = note.attachments.filter((a) => a.kind === "voice");
  const mono = fontFamily("mono");

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <View style={styles.typeRow} accessibilityRole="radiogroup">
          {NOTE_TYPES.map((t) => (
            <TypeBadge key={t.value} type={t.value} selected={type === t.value} onPress={() => onTypeChange(t.value)} />
          ))}
        </View>
      </View>
      <View style={styles.metaRow}>
        <Text style={{ fontFamily: mono, fontSize: 12, color: colors.inkFaint }}>{note.zettelId}</Text>
        <SaveStatus status={status} />
      </View>

      <TextInput
        value={title}
        onChangeText={onTitleChange}
        placeholder={COPY.titlePlaceholder}
        placeholderTextColor={colors.inkFaint}
        style={[styles.titleInput, displayText]}
      />

      <TextInput
        value={content}
        onChangeText={onContentChange}
        selection={forcedSelection}
        onSelectionChange={(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
          setSelection(e.nativeEvent.selection);
          setForcedSelection(undefined);
        }}
        placeholder={COPY.editorPlaceholder}
        placeholderTextColor={colors.inkFaint}
        multiline
        textAlignVertical="top"
        style={[styles.contentInput, { color: colors.ink }]}
      />

      {suggestions.length > 0 && (
        <View style={styles.suggestions} accessibilityLabel="Link suggestions">
          {suggestions.map((n) => (
            <Chip key={n.id} label={n.title} onPress={() => applySuggestion(n.title)} />
          ))}
        </View>
      )}

      <View style={styles.actionRow}>
        {Platform.OS !== "web" && <Button compact icon="camera" label="Camera" onPress={() => pickAndUploadPhoto("camera")} disabled={uploadingPhoto} />}
        <Button compact icon="image" label="Photo" onPress={() => pickAndUploadPhoto("library")} disabled={uploadingPhoto} />
        <Button compact variant={recording ? "danger" : "secondary"} icon={recording ? "stop" : "mic"} label={recording ? "Stop" : "Voice note"} onPress={toggleRecording} />
      </View>
      {attachmentError && <ErrorText>{attachmentError}</ErrorText>}

      {note.attachments.length > 0 && (
        <View style={styles.section}>
          <SectionHeading icon="paperclip">{`${COPY.attachments} (${note.attachments.length})`}</SectionHeading>
          {photos.length > 0 && (
            <View style={styles.photoRow}>
              {photos.map((a) => (
                <PhotoThumbnail key={a.id} id={a.id} onRemove={() => removeAttachment(a.id)} />
              ))}
            </View>
          )}
          {voiceNotes.length > 0 && (
            <View style={styles.voiceList}>
              {voiceNotes.map((a) => (
                <VoiceNotePlayer key={a.id} id={a.id} onRemove={() => removeAttachment(a.id)} />
              ))}
            </View>
          )}
        </View>
      )}

      {note.tagNames.length > 0 && (
        <View style={styles.tagRow}>
          {note.tagNames.map((name) => (
            <Chip key={name} label={`#${name}`} onPress={() => filterByTag(name)} />
          ))}
        </View>
      )}

      <View style={styles.section}>
        <SectionHeading icon={type === "structure" ? "layers" : "network"}>{`${type === "structure" ? "Contents" : "Links"} (${note.contents.length})`}</SectionHeading>
        {note.contents.length === 0 ? (
          <EmptyHint>{COPY.noLinks}</EmptyHint>
        ) : (
          note.contents.map((item, i) => (
            <NoteLink
              key={item.noteId ?? `${item.title}-${i}`}
              zettelId={item.zettelId}
              title={item.title}
              unresolved={!item.resolved}
              onPress={() => openLinkedTitle(item.title, item.noteId)}
            />
          ))
        )}
      </View>

      <View style={styles.section}>
        <SectionHeading icon="link">{`${COPY.linkedMentions} (${note.backlinks.length})`}</SectionHeading>
        {note.backlinks.length === 0 ? (
          <EmptyHint>{COPY.noBacklinks}</EmptyHint>
        ) : (
          note.backlinks.map((b) => <NoteLink key={b.noteId} zettelId={b.zettelId} title={b.title} onPress={() => openLinkedTitle(b.title, b.noteId)} />)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  headerRow: { marginBottom: 10 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  typeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", flexShrink: 1 },
  titleInput: { fontSize: 26, marginBottom: 12, padding: 0 },
  contentInput: { fontSize: 16, lineHeight: 24, minHeight: 200, padding: 0 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  voiceList: { gap: 8 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 20 },
  section: { marginTop: 24 },
});
