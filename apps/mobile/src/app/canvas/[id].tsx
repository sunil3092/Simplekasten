import { COPY } from "@simplekasten/core";
import { CANVAS_CARD, moveCanvasCard, newCanvasCard, resizeCanvasCard, type CanvasCard, type CanvasData, type NoteListItem } from "@simplekasten/local-engine";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { Icon } from "@/components/Icon";
import { Button, fontFamily } from "@/components/ui";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

const MONO = fontFamily("mono");
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;
// A touch that moves less than this is a tap, not a pan — same threshold
// the graph screen's gesture code uses.
const TAP_SLOP = 6;
// Room around the outermost cards, so a card dragged past the others is still
// inside the surface (Android only sends touches to children within bounds).
const SURFACE_MARGIN = 300;
// Bigger than it looks on desktop: a fingertip has to land on it.
const RESIZE_HANDLE = 30;

function touchDistance(e: GestureResponderEvent) {
  const [a, b] = e.nativeEvent.touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

interface CanvasCardViewProps {
  card: CanvasCard;
  origin: { x: number; y: number };
  note: NoteListItem | undefined;
  scaleRef: { current: number };
  onChange: (id: string, change: (start: CanvasCard) => CanvasCard, start: CanvasCard) => void;
  onCommit: () => void;
  onRemove: (id: string) => void;
  onOpenNote: (noteId: string) => void;
  onText: (id: string, text: string) => void;
}

// One card on the board. The header strip moves it, the corner resizes it,
// both as on desktop.
const CanvasCardView = memo(function CanvasCardView({ card, origin, note, scaleRef, onChange, onCommit, onRemove, onOpenNote, onText }: CanvasCardViewProps) {
  const { colors, shape } = useTheme();
  const cardRef = useRef(card);
  cardRef.current = card;
  const start = useRef(card);

  // Each handle keeps the touch once it has it, or a drag would turn into a
  // pan of the board behind.
  const handle = (change: (from: CanvasCard, dx: number, dy: number) => CanvasCard) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start.current = cardRef.current;
      },
      onPanResponderMove: (_e, g) => {
        if (Math.hypot(g.dx, g.dy) < TAP_SLOP) return;
        const scale = scaleRef.current;
        onChange(card.id, (from) => change(from, g.dx / scale, g.dy / scale), start.current);
      },
      onPanResponderRelease: onCommit,
      onPanResponderTerminate: onCommit,
    });
  const move = useMemo(() => handle(moveCanvasCard), [card.id, onChange, onCommit]); // eslint-disable-line react-hooks/exhaustive-deps
  const resize = useMemo(() => handle(resizeCanvasCard), [card.id, onChange, onCommit]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View
      accessibilityLabel={card.kind === "note" ? `Note card ${note?.title ?? ""}` : "Text card"}
      style={[
        styles.card,
        {
          left: card.x - origin.x,
          top: card.y - origin.y,
          width: card.width,
          height: card.height,
          borderWidth: shape.borderWidth,
          borderRadius: shape.radius,
          borderColor: colors.line,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View style={[styles.cardHeader, { backgroundColor: colors.surface2 }]}>
        <View {...move.panHandlers} accessibilityLabel="Move card" style={styles.cardHandle} />
        <Pressable accessibilityRole="button" accessibilityLabel="Remove card" hitSlop={8} onPress={() => onRemove(card.id)} style={styles.cardRemove}>
          <Icon name="x" size={13} color={colors.inkFaint} />
        </Pressable>
      </View>
      {card.kind === "note" ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${note?.title ?? "note"}`} onPress={() => onOpenNote(card.noteId)} style={styles.cardBody}>
          <Text style={{ fontFamily: MONO, fontSize: 10, color: colors.inkFaint, marginBottom: 4 }}>{note?.zettelId ?? "?"}</Text>
          <Text numberOfLines={4} style={{ fontSize: 14, color: colors.ink }}>
            {note?.title ?? "(note not found)"}
          </Text>
        </Pressable>
      ) : (
        <TextInput
          accessibilityLabel="Card text"
          value={card.text}
          onChangeText={(text) => onText(card.id, text)}
          onBlur={onCommit}
          placeholder="Type a note…"
          placeholderTextColor={colors.inkFaint}
          multiline
          textAlignVertical="top"
          style={[styles.cardBody, styles.cardText, { color: colors.ink }]}
        />
      )}
      <View {...resize.panHandlers} accessibilityLabel="Resize card" style={styles.resizeHandle}>
        <View style={[styles.resizeMark, { borderColor: colors.inkFaint }]} />
      </View>
    </View>
  );
});

// A corkboard: freely positioned, resizable note cards and text cards, no
// connecting lines (see canvas.md). Cards are added, moved, resized, edited
// and removed here, as on desktop.
export default function CanvasScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, shape } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const [canvas, setCanvas] = useState<CanvasData | null>(null);
  const [cards, setCards] = useState<CanvasCard[]>([]);
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  const viewRef = useRef(view);
  viewRef.current = view;
  const scaleRef = useRef(1);
  scaleRef.current = view.scale;
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const dirtyRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      vault.getCanvas(id).then((data) => {
        setCanvas(data);
        setCards(data.cards);
        navigation.setOptions({ title: data.title });
      });
      vault.listNotes().then(setNotes).catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  );

  const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);

  const persist = useCallback(
    async (next: CanvasCard[]) => {
      dirtyRef.current = false;
      await vault.updateCanvas({ id, cards: next });
    },
    [id],
  );

  // Text typed into a card is written when the card loses focus; leaving the
  // screen with the keyboard still up must not lose it.
  useEffect(
    () => () => {
      if (dirtyRef.current) void vault.updateCanvas({ id, cards: cardsRef.current });
    },
    [id],
  );

  const onChange = useCallback((cardId: string, change: (start: CanvasCard) => CanvasCard, start: CanvasCard) => {
    dirtyRef.current = true;
    // Text typed since the drag began lives on the current card, so only the
    // geometry is taken from the drag.
    const { x, y, width, height } = change(start);
    setCards((current) => current.map((c) => (c.id === cardId ? { ...c, x, y, width, height } : c)));
  }, []);
  const onCommit = useCallback(() => {
    if (dirtyRef.current) void persist(cardsRef.current);
  }, [persist]);
  const onText = useCallback((cardId: string, text: string) => {
    dirtyRef.current = true;
    setCards((current) => current.map((c) => (c.id === cardId && c.kind === "text" ? { ...c, text } : c)));
  }, []);
  const onRemove = useCallback(
    (cardId: string) => {
      const next = cardsRef.current.filter((c) => c.id !== cardId);
      setCards(next);
      void persist(next);
    },
    [persist],
  );
  const onOpenNote = useCallback(
    (noteId: string) => {
      onCommit();
      router.push(`/vault/${noteId}`);
    },
    [onCommit, router],
  );

  // New cards land in the middle of what is on screen.
  function viewportCentre() {
    const v = viewRef.current;
    return { x: (sizeRef.current.width / 2 - v.x) / v.scale, y: (sizeRef.current.height / 2 - v.y) / v.scale };
  }

  function addCard(content: { kind: "note"; noteId: string } | { kind: "text"; text: string }) {
    const next = [...cardsRef.current, newCanvasCard(content, viewportCentre())];
    setCards(next);
    void persist(next);
  }

  function addNoteCard(noteId: string) {
    setPickerOpen(false);
    setPickerQuery("");
    addCard({ kind: "note", noteId });
  }

  async function createAndAdd(title: string) {
    const note = await vault.createNote({ title, content: "", type: "fleeting" });
    setNotes(await vault.listNotes());
    addNoteCard(note.id);
  }

  // The surface is sized to hold every card (see SURFACE_MARGIN).
  const bounds = useMemo(() => {
    if (cards.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    const minX = Math.min(...cards.map((c) => c.x)) - SURFACE_MARGIN;
    const minY = Math.min(...cards.map((c) => c.y)) - SURFACE_MARGIN;
    const maxX = Math.max(...cards.map((c) => c.x + c.width)) + SURFACE_MARGIN;
    const maxY = Math.max(...cards.map((c) => c.y + c.height)) + SURFACE_MARGIN;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [cards]);
  const origin = useMemo(() => ({ x: bounds.x, y: bounds.y }), [bounds.x, bounds.y]);

  // ---- Pan & pinch-zoom ----------------------------------------------------
  const surfaceRef = useRef<View>(null);
  const surfaceOffset = useRef({ x: 0, y: 0 });
  const gesture = useRef({ start: view, pinchStart: 0, moved: false });
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (e, g) => e.nativeEvent.touches.length >= 2 || Math.hypot(g.dx, g.dy) > TAP_SLOP,
        onPanResponderGrant: () => {
          gesture.current = { start: viewRef.current, pinchStart: 0, moved: false };
        },
        onPanResponderMove: (e, g) => {
          if (e.nativeEvent.touches.length >= 2) {
            const distance = touchDistance(e);
            if (!gesture.current.pinchStart) {
              gesture.current = { start: viewRef.current, pinchStart: distance, moved: true };
              return;
            }
            const [a, b] = e.nativeEvent.touches;
            const midX = (a.pageX + b.pageX) / 2 - surfaceOffset.current.x;
            const midY = (a.pageY + b.pageY) / 2 - surfaceOffset.current.y;
            const s0 = gesture.current.start;
            const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s0.scale * (distance / gesture.current.pinchStart)));
            // Keep the point under the fingers' midpoint fixed while scaling.
            const k = scale / s0.scale;
            setView({ scale, x: midX - (midX - s0.x) * k, y: midY - (midY - s0.y) * k });
            return;
          }
          if (Math.hypot(g.dx, g.dy) > TAP_SLOP) gesture.current.moved = true;
          const start = gesture.current.start;
          if (gesture.current.moved && !gesture.current.pinchStart) setView({ ...start, x: start.x + g.dx, y: start.y + g.dy });
        },
        onPanResponderRelease: () => {
          if (!gesture.current.moved) Keyboard.dismiss();
        },
      }),
    [],
  );

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
    surfaceRef.current?.measureInWindow((x, y) => {
      surfaceOffset.current = { x, y };
    });
  }

  const query = pickerQuery.trim().toLowerCase();
  const pickable = query ? notes.filter((n) => n.title.toLowerCase().includes(query)) : notes;
  const exactMatch = notes.some((n) => n.title.toLowerCase() === query);

  // Scaling happens around the surface's centre, so the shift that would
  // have put its top-left corner at the right place is worked out by hand.
  const translateX = view.x + bounds.x * view.scale - (bounds.width / 2) * (1 - view.scale);
  const translateY = view.y + bounds.y * view.scale - (bounds.height / 2) * (1 - view.scale);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.toolbar, { borderBottomWidth: shape.borderWidth, borderBottomColor: colors.line }]}>
        <Button compact icon="plus" label="Note card" onPress={() => setPickerOpen(true)} disabled={!canvas} />
        <Button compact icon="fileText" label="Text card" onPress={() => addCard({ kind: "text", text: "" })} disabled={!canvas} />
      </View>

      <View ref={surfaceRef} style={[styles.surface, { backgroundColor: colors.surface2 }]} onLayout={onLayout} {...responder.panHandlers}>
        {canvas && cards.length === 0 && <Text style={[styles.empty, { color: colors.inkFaint }]}>This canvas is empty — add a note card or a text card.</Text>}
        {cards.length > 0 && (
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: bounds.width,
              height: bounds.height,
              transform: [{ translateX }, { translateY }, { scale: view.scale }],
            }}
          >
            {cards.map((card) => (
              <CanvasCardView
                key={card.id}
                card={card}
                origin={origin}
                note={card.kind === "note" ? notesById.get(card.noteId) : undefined}
                scaleRef={scaleRef}
                onChange={onChange}
                onCommit={onCommit}
                onRemove={onRemove}
                onOpenNote={onOpenNote}
                onText={onText}
              />
            ))}
          </View>
        )}
      </View>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable accessibilityLabel="Close note picker" style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          {/* A Pressable so taps inside the sheet don't fall through to the backdrop and close it. */}
          <Pressable
            accessibilityLabel="Add a note card"
            onPress={() => {}}
            style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: shape.borderWidth, borderRadius: shape.radius }]}
          >
            <TextInput
              accessibilityLabel="Search notes"
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder={COPY.searchPlaceholder}
              placeholderTextColor={colors.inkFaint}
              autoFocus
              style={[styles.pickerInput, { color: colors.ink, borderBottomColor: colors.line, borderBottomWidth: shape.borderWidth }]}
            />
            <FlatList
              data={pickable}
              keyExtractor={(n) => n.id}
              keyboardShouldPersistTaps="handled"
              style={styles.pickerList}
              renderItem={({ item }) => (
                <Pressable accessibilityRole="button" onPress={() => addNoteCard(item.id)} style={styles.pickerRow}>
                  <Text style={{ fontFamily: MONO, fontSize: 11, color: colors.inkFaint, minWidth: 24 }}>{item.zettelId}</Text>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, color: colors.ink }}>
                    {item.title}
                  </Text>
                </Pressable>
              )}
              ListFooterComponent={
                query && !exactMatch ? (
                  <Pressable accessibilityRole="button" onPress={() => createAndAdd(pickerQuery.trim())} style={styles.pickerRow}>
                    <Icon name="plus" color={colors.accent2} />
                    <Text style={{ color: colors.accent2, fontSize: 15 }}>{COPY.createNote(pickerQuery.trim())}</Text>
                  </Pressable>
                ) : null
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  surface: { flex: 1, overflow: "hidden" },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14, paddingHorizontal: 24 },
  card: { position: "absolute", overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", height: CANVAS_CARD.headerHeight },
  cardHandle: { flex: 1, alignSelf: "stretch" },
  cardRemove: { width: 30, height: CANVAS_CARD.headerHeight, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, padding: 10 },
  cardText: { fontSize: 13, lineHeight: 18, paddingTop: 8 },
  resizeHandle: { position: "absolute", right: 0, bottom: 0, width: RESIZE_HANDLE, height: RESIZE_HANDLE, alignItems: "flex-end", justifyContent: "flex-end", padding: 4 },
  resizeMark: { width: 10, height: 10, borderRightWidth: 2, borderBottomWidth: 2, opacity: 0.6 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-start", padding: 24, paddingTop: 80 },
  picker: { maxHeight: 420, overflow: "hidden" },
  pickerInput: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  pickerList: { flexGrow: 0 },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
});
