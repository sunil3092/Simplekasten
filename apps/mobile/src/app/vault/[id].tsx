import { COPY } from "@simplekasten/core";
import type { NoteDetail, NoteListItem, TagItem } from "@simplekasten/local-engine";
import { NOTE_TYPES, type NoteTypeInfo } from "@simplekasten/themes";
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { NoteTextInput } from "@/components/NoteTextInput";
import { PhotoThumbnail } from "@/components/PhotoThumbnail";
import { TagSheet } from "@/components/TagSheet";
import { Button, Chip, EmptyHint, ErrorText, fontFamily, IconButton, NoteLink, SaveStatus, SectionHeading, TypeBadge, useDisplayText } from "@/components/ui";
import { VoiceNotePlayer } from "@/components/VoiceNotePlayer";
import { setLastNote } from "@/lib/lastNote";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

type NoteType = NoteTypeInfo["value"];

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, shape } = useTheme();
  const displayText = useDisplayText();
  const router = useRouter();
  const navigation = useNavigation();

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [allNotes, setAllNotes] = useState<NoteListItem[]>([]);
  const [vaultTags, setVaultTags] = useState<TagItem[]>([]);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<NoteType>("fleeting");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [recording, setRecording] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ title: string; content: string; type: NoteType } | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);

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
    vault.listTemplates().then(setTemplates).catch(() => {});
  }, [id]);

  // Inserting a template only needs its name, so an action sheet is enough;
  // templates are made and edited on the Templates screen.
  function applyTemplateSheet() {
    if (templates.length === 0) return;
    Alert.alert(
      "Insert template",
      undefined,
      [
        ...templates.map((t) => ({
          text: t.name,
          onPress: async () => {
            const updated = await vault.applyTemplate({ noteId: id, templateId: t.id });
            setNote(updated);
            setContent(updated.content);
          },
        })),
        { text: "Cancel", style: "cancel" as const },
      ],
    );
  }

  // Coming back to this screen (from a linked note, or the graph) can find
  // its links stale — a note it pointed at may have just been created — so
  // derived fields and the title list are refetched on every focus. Title
  // and content aren't, so an in-progress edit is never overwritten.
  useFocusEffect(
    useCallback(() => {
      setLastNote(id);
      vault.listNotes().then(setAllNotes).catch(() => {});
      vault.listTags().then(setVaultTags).catch(() => {});
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
      headerRight: () => (
        <View style={{ flexDirection: "row", gap: 4 }}>
          {note?.type === "daily" && (
            <>
              <IconButton icon="chevronLeft" label="Previous day" onPress={() => openDailyOffset(-1)} />
              <IconButton icon="chevronRight" label="Next day" onPress={() => openDailyOffset(1)} />
            </>
          )}
          {templates.length > 0 && <IconButton icon="fileText" label="Insert template" onPress={applyTemplateSheet} />}
          <IconButton icon="history" label="Version history" onPress={() => router.push({ pathname: "/history", params: { noteId: id } })} />
          <IconButton icon="trash" label="Delete note" onPress={confirmDelete} />
        </View>
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

  // ---- Tags ----------------------------------------------------------------
  async function updateTags(assignedTags: string[]) {
    // Optimistic, so the checkbox flips at once; the engine's answer (which
    // merges in #hashtags) replaces it right after.
    setNote((current) => (current ? { ...current, assignedTags } : current));
    await flushPending();
    setStatus("saving");
    await vault.updateNote({ id, tags: assignedTags });
    await refreshNote();
    setStatus("saved");
    vault.listTags().then(setVaultTags).catch(() => {});
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
        <View style={styles.metaLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${COPY.tags}${note.tagNames.length ? ` (${note.tagNames.length})` : ""}`}
            onPress={() => setTagSheetOpen(true)}
            style={[styles.tagTrigger, { borderWidth: shape.borderWidth, borderRadius: Math.min(shape.radius, 6), borderColor: colors.line, backgroundColor: colors.surface2 }]}
          >
            <Icon name="hash" size={11} color={colors.inkMuted} />
            <Text style={{ fontFamily: mono, fontSize: 10, letterSpacing: 0.5, color: colors.inkMuted }}>
              {COPY.tags.toUpperCase()}
              {note.tagNames.length > 0 ? ` ${note.tagNames.length}` : ""}
            </Text>
            <Icon name="chevronDown" size={11} color={colors.inkFaint} />
          </Pressable>
          <Text style={{ fontFamily: mono, fontSize: 12, color: colors.inkFaint }}>{note.zettelId}</Text>
        </View>
        <SaveStatus status={status} />
      </View>

      <TextInput
        value={title}
        onChangeText={onTitleChange}
        placeholder={COPY.titlePlaceholder}
        placeholderTextColor={colors.inkFaint}
        style={[styles.titleInput, displayText]}
      />

      <NoteTextInput
        value={content}
        onChangeText={onContentChange}
        titles={allNotes.filter((n) => n.id !== id).map((n) => n.title)}
        tags={vaultTags.map((t) => t.name)}
        style={[styles.contentInput, { color: colors.ink }]}
      />

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
      <TagSheet
        visible={tagSheetOpen}
        vaultTags={vaultTags}
        assigned={note.assignedTags}
        onNote={note.tagNames}
        onChange={updateTags}
        onClose={() => setTagSheetOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  headerRow: { marginBottom: 10 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  metaLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  typeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", flexShrink: 1 },
  tagTrigger: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 4 },
  titleInput: { fontSize: 26, marginBottom: 12, padding: 0 },
  contentInput: { fontSize: 16, lineHeight: 24, minHeight: 200, padding: 0 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  voiceList: { gap: 8 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 20 },
  section: { marginTop: 24 },
});
