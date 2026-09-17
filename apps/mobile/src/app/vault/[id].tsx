import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from "expo-audio";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PhotoThumbnail } from "@/components/PhotoThumbnail";
import { VoiceNotePlayer } from "@/components/VoiceNotePlayer";
import { vault } from "@/lib/vault";
import { useThemeColors } from "@/theme";

type NoteType = "fleeting" | "literature" | "permanent" | "structure";
interface Attachment { id: string; kind: "photo" | "voice" }
interface NoteDetail {
  id: string; zettelId: string; title: string; content: string; type: NoteType;
  tagNames: string[]; attachments: Attachment[];
  backlinks: { noteId: string; title: string }[];
  contents: { noteId: string | null; title: string; resolved: boolean }[];
}

const TYPES: { value: NoteType; label: string }[] = [
  { value: "fleeting", label: "Fleeting" },
  { value: "literature", label: "Literature" },
  { value: "permanent", label: "Permanent" },
  { value: "structure", label: "Structure" },
];

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const router = useRouter();
  const navigation = useNavigation();

  const [note, setNote] = useState<NoteDetail | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<NoteType>("fleeting");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [recording, setRecording] = useState(false);
  const [dictating, setDictating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dictationBaseRef = useRef("");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    (vault.getNoteById(id) as Promise<NoteDetail>).then((detail) => {
      setNote(detail);
      setTitle(detail.title);
      setContent(detail.content);
      setType(detail.type);
      setStatus("saved");
    });
  }, [id]);

  useEffect(() => {
    navigation.setOptions({ title: title || "Untitled" });
  }, [navigation, title]);

  // Live partial and final transcripts both arrive as "result" events;
  // dictationBaseRef holds whatever was already in the content field so a
  // second dictation pass appends rather than replacing it.
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript ?? "";
    const base = dictationBaseRef.current;
    const next = base ? `${base} ${transcript}` : transcript;
    setContent(next);
    scheduleSave({ title, content: next, type });
  });
  useSpeechRecognitionEvent("end", () => setDictating(false));
  // The module can fail asynchronously after start() already returned
  // successfully (e.g. no network reaching the recognition service, or no
  // real microphone) — surfacing the reason here is what turns that into a
  // legible state instead of the dictate button silently flipping back off.
  useSpeechRecognitionEvent("error", (event) => {
    setDictating(false);
    setAttachmentError(`Speech recognition stopped: ${event.message || event.error}`);
  });

  async function refreshNote() {
    const fresh = await (vault.getNoteById(id) as Promise<NoteDetail>);
    setNote(fresh);
  }

  function scheduleSave(next: { title: string; content: string; type: NoteType }) {
    setStatus("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setStatus("saving");
      await vault.updateNote({ id, ...next });
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

  async function pickAndUploadPhoto(source: "camera" | "library") {
    setAttachmentError(null);
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
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

  async function toggleDictation() {
    setAttachmentError(null);
    if (dictating) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setAttachmentError("Speech recognition permission was denied.");
        return;
      }
      dictationBaseRef.current = content;
      setDictating(true);
      ExpoSpeechRecognitionModule.start({ lang: "en-US", interimResults: true, continuous: true });
    } catch {
      setDictating(false);
      setAttachmentError("Speech recognition isn't available here.");
    }
  }

  if (!note) return null;

  const photos = note.attachments.filter((a) => a.kind === "photo");
  const voiceNotes = note.attachments.filter((a) => a.kind === "voice");

  return (
    <ScrollView style={{ backgroundColor: colors.surface }} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.typeRow}>
          {TYPES.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => onTypeChange(t.value)}
              style={[
                styles.typePill,
                {
                  borderColor: type === t.value ? colors.accent : colors.line,
                  backgroundColor: type === t.value ? colors.accentSoft : "transparent",
                },
              ]}
            >
              <Text style={{ fontSize: 10, color: type === t.value ? colors.accentInk : colors.inkFaint }}>
                {t.label.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ fontSize: 11, color: colors.inkFaint }}>{status === "saving" ? "Saving…" : "Saved"}</Text>
      </View>

      <TextInput
        value={title}
        onChangeText={onTitleChange}
        placeholder="Untitled"
        placeholderTextColor={colors.inkFaint}
        style={[styles.titleInput, { color: colors.ink }]}
      />

      <View style={styles.contentWrap}>
        <TextInput
          value={content}
          onChangeText={onContentChange}
          placeholder="Start writing… use [[Note Title]] to link."
          placeholderTextColor={colors.inkFaint}
          multiline
          textAlignVertical="top"
          style={[styles.contentInput, { color: colors.ink }]}
        />
        <Pressable
          onPress={toggleDictation}
          style={[
            styles.micButton,
            { borderColor: dictating ? colors.accent : colors.line, backgroundColor: dictating ? colors.accentSoft : colors.surface },
          ]}
        >
          <Text style={{ fontSize: 14 }}>{dictating ? "⏹" : "🎤"}</Text>
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        {Platform.OS !== "web" && (
          <Pressable onPress={() => pickAndUploadPhoto("camera")} disabled={uploadingPhoto} style={[styles.actionButton, { borderColor: colors.line }]}>
            <Text style={{ color: colors.inkMuted, fontSize: 13 }}>📷 Camera</Text>
          </Pressable>
        )}
        <Pressable onPress={() => pickAndUploadPhoto("library")} disabled={uploadingPhoto} style={[styles.actionButton, { borderColor: colors.line }]}>
          <Text style={{ color: colors.inkMuted, fontSize: 13 }}>🖼 Photo</Text>
        </Pressable>
        <Pressable
          onPress={toggleRecording}
          style={[styles.actionButton, { borderColor: recording ? colors.accent2 : colors.line, backgroundColor: recording ? colors.accent2Soft : "transparent" }]}
        >
          <Text style={{ color: recording ? colors.accent2 : colors.inkMuted, fontSize: 13 }}>{recording ? "⏹ Stop" : "🎙 Voice note"}</Text>
        </Pressable>
      </View>
      {attachmentError && <Text style={{ color: "#c0392b", fontSize: 12, marginTop: 6 }}>{attachmentError}</Text>}

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

      {note.tagNames.length > 0 && (
        <View style={styles.tagRow}>
          {note.tagNames.map((name) => (
            <View key={name} style={[styles.tagChip, { borderColor: colors.line }]}>
              <Text style={{ fontSize: 11, color: colors.inkMuted }}>#{name}</Text>
            </View>
          ))}
        </View>
      )}

      {type === "structure" && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.inkFaint }]}>CONTENTS ({note.contents.length})</Text>
          {note.contents.map((item, i) => (
            <Pressable
              key={item.noteId ?? `${item.title}-${i}`}
              disabled={!item.noteId}
              onPress={() => item.noteId && router.push(`/vault/${item.noteId}`)}
              style={[styles.linkRow, { borderColor: item.resolved ? colors.line : colors.line, borderStyle: item.resolved ? "solid" : "dashed" }]}
            >
              <Text style={{ color: item.resolved ? colors.ink : colors.inkFaint, fontSize: 14 }}>{item.title}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.inkFaint }]}>LINKED MENTIONS ({note.backlinks.length})</Text>
        {note.backlinks.length === 0 ? (
          <Text style={{ color: colors.inkFaint, fontSize: 13 }}>Nothing links here yet.</Text>
        ) : (
          note.backlinks.map((b) => (
            <Pressable key={b.noteId} onPress={() => router.push(`/vault/${b.noteId}`)} style={[styles.linkRow, { borderColor: colors.line }]}>
              <Text style={{ color: colors.ink, fontSize: 14 }}>{b.title}</Text>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  typeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", flexShrink: 1 },
  typePill: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3 },
  titleInput: { fontSize: 26, fontWeight: "700", marginBottom: 12, padding: 0 },
  contentWrap: { position: "relative" },
  contentInput: { fontSize: 16, lineHeight: 24, minHeight: 200, padding: 0, paddingRight: 36 },
  micButton: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  actionButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  voiceList: { gap: 8, marginTop: 14 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 16 },
  tagChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 11, fontFamily: "monospace", letterSpacing: 0.5, marginBottom: 8 },
  linkRow: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
});
