import type { CanvasCard, CanvasData, NoteListItem } from "@simplekasten/local-engine";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;
// A touch that moves less than this is a tap, not a pan — same threshold
// the graph screen's gesture code uses.
const TAP_SLOP = 6;

function touchDistance(e: GestureResponderEvent) {
  const [a, b] = e.nativeEvent.touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

// View-only: pan/zoom and tap-a-note-card-to-open-it, same gesture code
// shape as (tabs)/graph.tsx's hand-rolled PanResponder. No drag, resize, or
// card creation here — see canvas.md's desktop-authors/mobile-views split.
export default function CanvasScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, shape } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const [canvas, setCanvas] = useState<CanvasData | null>(null);
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });

  useFocusEffect(
    useCallback(() => {
      vault.getCanvas(id).then((data) => {
        setCanvas(data);
        navigation.setOptions({ title: data.title });
      });
      vault.listNotes().then(setNotes).catch(() => {});
      setView({ x: 0, y: 0, scale: 1 });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  );

  const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);

  const viewRef = useRef(view);
  viewRef.current = view;
  const cardsRef = useRef<CanvasCard[]>([]);
  cardsRef.current = canvas?.cards ?? [];
  const gesture = useRef({ start: view, pinchStart: 0, moved: false });

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          gesture.current = { start: viewRef.current, pinchStart: 0, moved: false };
        },
        onPanResponderMove: (e, g) => {
          const start = gesture.current.start;
          if (e.nativeEvent.touches.length >= 2) {
            gesture.current.moved = true;
            const distance = touchDistance(e);
            if (!gesture.current.pinchStart) {
              gesture.current = { start: viewRef.current, pinchStart: distance, moved: true };
              return;
            }
            const [a, b] = e.nativeEvent.touches;
            const midX = (a.locationX + b.locationX) / 2;
            const midY = (a.locationY + b.locationY) / 2;
            const s0 = gesture.current.start;
            const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s0.scale * (distance / gesture.current.pinchStart)));
            const k = scale / s0.scale;
            setView({ scale, x: midX - (midX - s0.x) * k, y: midY - (midY - s0.y) * k });
            return;
          }
          if (Math.hypot(g.dx, g.dy) > TAP_SLOP) gesture.current.moved = true;
          if (gesture.current.moved && !gesture.current.pinchStart) setView({ ...start, x: start.x + g.dx, y: start.y + g.dy });
        },
        onPanResponderRelease: (e) => {
          if (gesture.current.moved) return;
          const { locationX, locationY } = e.nativeEvent;
          const v = viewRef.current;
          for (let i = cardsRef.current.length - 1; i >= 0; i--) {
            const c = cardsRef.current[i];
            const left = c.x * v.scale + v.x;
            const top = c.y * v.scale + v.y;
            const right = left + c.width * v.scale;
            const bottom = top + c.height * v.scale;
            if (locationX >= left && locationX <= right && locationY >= top && locationY <= bottom) {
              if (c.kind === "note") router.push(`/vault/${c.noteId}`);
              return;
            }
          }
        },
      }),
    [router],
  );

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]} onLayout={onLayout} {...responder.panHandlers}>
      {canvas?.cards.map((card) => {
        const left = card.x * view.scale + view.x;
        const top = card.y * view.scale + view.y;
        const width = card.width * view.scale;
        const height = card.height * view.scale;
        const note = card.kind === "note" ? notesById.get(card.noteId) : null;
        return (
          <View
            key={card.id}
            style={[
              styles.card,
              { left, top, width, height, borderWidth: shape.borderWidth, borderRadius: shape.radius, borderColor: colors.line, backgroundColor: colors.surface },
            ]}
          >
            {card.kind === "note" ? (
              <>
                <Text style={{ fontSize: 10, color: colors.inkFaint, marginBottom: 4 }}>{note?.zettelId ?? "?"}</Text>
                <Text numberOfLines={4} style={{ fontSize: 14, color: colors.ink }}>
                  {note?.title ?? "(note not found)"}
                </Text>
              </>
            ) : (
              <Text numberOfLines={6} style={{ fontSize: 13, color: colors.inkMuted }}>
                {card.text || "(empty)"}
              </Text>
            )}
          </View>
        );
      })}
      {canvas?.cards.length === 0 && (
        <Text style={[styles.empty, { color: colors.inkFaint }]}>This canvas is empty — add cards on desktop.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden" },
  card: { position: "absolute", padding: 10, overflow: "hidden" },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14, paddingHorizontal: 24 },
});
