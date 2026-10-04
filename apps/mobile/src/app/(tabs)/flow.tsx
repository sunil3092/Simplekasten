import { COPY, extractWikiLinkTitles, hashtagLine, JOURNAL_TAG } from "@simplekasten/core";
import {
  filterFlowNodes,
  FLOW_CARD,
  flowAutoPositions,
  flowRoutes,
  flowTagOptions,
  layoutFlow,
  placeFlowCards,
  type FlowPoint,
  type FlowPositions,
  type GraphData,
  type GraphNode,
} from "@simplekasten/local-engine";
import { NOTE_TYPES, noteTypeInfo, type NoteTypeInfo } from "@simplekasten/themes";
import { useFocusEffect, useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { Defs, Marker, Path, Svg } from "react-native-svg";
import { Icon } from "@/components/Icon";
import { Button, Chip, EmptyHint, fontFamily, TypeBadge } from "@/components/ui";
import { loadFlowPositions, saveFlowPositions } from "@/lib/settings";
import { vault } from "@/lib/vault";
import { useTheme } from "@/theme";

type NoteType = NoteTypeInfo["value"];
type CardText = { title: string; content: string };

const MONO = fontFamily("mono");
const MIN_SCALE = 0.3;
const MAX_SCALE = 2;
const SAVE_DEBOUNCE_MS = 600;
// A touch that moves less than this is a tap, not a pan — same threshold the
// graph and canvas screens use.
const TAP_SLOP = 6;
// Room around the outermost cards, so arrows that bend around them and the
// cards' own borders are never clipped by the surface's edge.
const SURFACE_MARGIN = 200;

function touchDistance(e: GestureResponderEvent) {
  const [a, b] = e.nativeEvent.touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

interface FlowCardProps {
  node: GraphNode;
  text: CardText | undefined;
  position: FlowPoint;
  origin: FlowPoint;
  active: boolean;
  /** Just made with New note: its placeholder title is selected, ready to type over. */
  fresh: boolean;
  /** Titles that name an existing note, lowercased — a link to anything else is still to be made. */
  knownTitles: Set<string>;
  scaleRef: { current: number };
  registerTitle: (id: string, input: TextInput | null) => void;
  onTouch: (id: string) => void;
  onEditing: (id: string | null) => void;
  onTitle: (id: string, value: string) => void;
  onContent: (id: string, value: string) => void;
  onDrag: (id: string, spot: FlowPoint) => void;
  onDragEnd: () => void;
  onPickType: (id: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onLink: (id: string, title: string) => void;
}

// One note on the flow. Memoised: dragging or typing in one card re-renders
// that card, not every card on the surface.
const FlowCard = memo(function FlowCard({
  node,
  text,
  position,
  origin,
  active,
  fresh,
  knownTitles,
  scaleRef,
  registerTitle,
  onTouch,
  onEditing,
  onTitle,
  onContent,
  onDrag,
  onDragEnd,
  onPickType,
  onOpen,
  onDelete,
  onLink,
}: FlowCardProps) {
  const { colors, shape } = useTheme();
  const info = noteTypeInfo(node.type);
  const positionRef = useRef(position);
  positionRef.current = position;
  const dragStart = useRef(position);

  // The header strip is the drag handle, as on desktop. It refuses to hand
  // the touch to the surface behind it, or a drag would turn into a pan.
  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragStart.current = positionRef.current;
          onTouch(node.id);
        },
        onPanResponderMove: (_e, g) => {
          if (Math.hypot(g.dx, g.dy) < TAP_SLOP) return;
          const scale = scaleRef.current;
          onDrag(node.id, { x: dragStart.current.x + g.dx / scale, y: dragStart.current.y + g.dy / scale });
        },
        onPanResponderRelease: onDragEnd,
        onPanResponderTerminate: onDragEnd,
      }),
    [node.id, onDrag, onDragEnd, onTouch, scaleRef],
  );

  const links = useMemo(() => (text ? extractWikiLinkTitles(text.content) : []), [text]);

  return (
    <View
      accessibilityLabel={`Flow card ${text?.title || COPY.titlePlaceholder}`}
      style={[
        styles.card,
        {
          left: position.x - origin.x,
          top: position.y - origin.y,
          borderWidth: shape.borderWidth,
          borderRadius: shape.radius,
          borderColor: active ? colors.accent : colors.line,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View style={[styles.cardHeader, { borderBottomWidth: shape.borderWidth, borderBottomColor: colors.lineSoft, backgroundColor: colors.surface2 }]}>
        <View {...drag.panHandlers} accessibilityLabel="Move card" style={styles.cardHandle}>
          <Text style={{ fontFamily: MONO, fontSize: 10, color: colors.inkFaint }}>{node.zettelId}</Text>
          {node.type === "daily" && <Text style={{ fontFamily: MONO, fontSize: 9, color: colors.accentInk }}>JOURNAL</Text>}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Note type" onPress={() => onPickType(node.id)} hitSlop={6} style={styles.cardType}>
          <View style={[styles.typeDot, { backgroundColor: colors[info.graphColor] }]} />
          <Text style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 0.5, color: colors.inkMuted }}>{info.label.toUpperCase()}</Text>
          <Icon name="chevronDown" size={10} color={colors.inkFaint} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open note" onPress={() => onOpen(node.id)} hitSlop={6} style={styles.cardButton}>
          <Icon name="expand" size={13} color={colors.inkFaint} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Delete note" onPress={() => onDelete(node.id)} hitSlop={6} style={styles.cardButton}>
          <Icon name="trash" size={13} color={colors.inkFaint} />
        </Pressable>
      </View>
      {/* The inputs own their text once shown, so they wait for the note to load. */}
      {text && (
        <>
          <TextInput
            ref={(input) => registerTitle(node.id, input)}
            accessibilityLabel="Title"
            value={text.title}
            selectTextOnFocus={fresh}
            onChangeText={(value) => onTitle(node.id, value)}
            onFocus={() => {
              onTouch(node.id);
              onEditing(node.id);
            }}
            onBlur={() => onEditing(null)}
            placeholder={COPY.titlePlaceholder}
            placeholderTextColor={colors.inkFaint}
            style={[styles.cardTitle, { color: colors.ink }]}
          />
          <TextInput
            accessibilityLabel="Note text"
            value={text.content}
            onChangeText={(value) => onContent(node.id, value)}
            onFocus={() => {
              onTouch(node.id);
              onEditing(node.id);
            }}
            onBlur={() => onEditing(null)}
            placeholder={COPY.editorPlaceholder}
            placeholderTextColor={colors.inkFaint}
            multiline
            textAlignVertical="top"
            style={[styles.cardBody, { color: colors.ink }]}
          />
          {links.length > 0 && (
            // A [[link]] inside a text field can't be tapped on its own, so
            // each one gets a chip — the touch form of desktop's Ctrl+click.
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.cardLinks} contentContainerStyle={styles.cardLinksContent}>
              {links.map((title) => {
                const exists = knownTitles.has(title.toLowerCase());
                return (
                  <Pressable
                    key={title}
                    accessibilityRole="link"
                    accessibilityLabel={exists ? `Open ${title}` : `Create ${title}`}
                    onPress={() => onLink(node.id, title)}
                    style={[
                      styles.linkChip,
                      { borderWidth: shape.borderWidth, borderColor: exists ? colors.accent : colors.line, borderStyle: exists ? "solid" : "dashed" },
                    ]}
                  >
                    <Icon name={exists ? "link" : "plus"} size={9} color={exists ? colors.accentInk : colors.inkMuted} />
                    <Text numberOfLines={1} style={{ fontSize: 10, color: exists ? colors.accentInk : colors.inkMuted, maxWidth: 120 }}>
                      {title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
});

// The same links Graph shows, read top to bottom: a note that links to
// another sits above it. A working surface like desktop's FlowView — cards
// are edited, retyped, created, deleted and dragged here — with touch in
// place of mouse and keyboard (see the mobile flow view spec).
export default function FlowScreen() {
  const { colors, shape } = useTheme();
  const router = useRouter();
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [cardText, setCardText] = useState<Map<string, CardText>>(new Map());
  const [noteTags, setNoteTags] = useState<Map<string, string[]>>(new Map());
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [hideJournal, setHideJournal] = useState(false);
  // The card being typed in stays on screen even if its tags stop matching.
  const [editingId, setEditingId] = useState<string | null>(null);
  // The card last touched: its arrows are coloured, as hovering does on desktop.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [typePickerId, setTypePickerId] = useState<string | null>(null);
  const [moved, setMoved] = useState<FlowPositions>(new Map());
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState({ x: 0, y: 24, scale: 1 });

  const viewRef = useRef(view);
  viewRef.current = view;
  const scaleRef = useRef(1);
  scaleRef.current = view.scale;
  const movedRef = useRef(moved);
  movedRef.current = moved;
  const cardTextRef = useRef(cardText);
  cardTextRef.current = cardText;
  const noteTagsRef = useRef(noteTags);
  noteTagsRef.current = noteTags;
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const mountedRef = useRef(true);
  const centredRef = useRef(false);
  const titleInputs = useRef(new Map<string, TextInput>());
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingSaves = useRef(new Map<string, CardText>());
  const creatingLinks = useRef(new Set<string>());

  useEffect(() => {
    mountedRef.current = true;
    loadFlowPositions().then((saved) => mountedRef.current && setMoved(saved));
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshGraph = useCallback(async () => {
    const next = await vault.getGraph();
    if (mountedRef.current) setGraph(next);
    return next;
  }, []);

  // Loads the text and tags of notes not on the flow yet. A card that is
  // already showing is left alone: reloading it would overwrite what is being
  // typed in it.
  const loadCards = useCallback(async (nodes: GraphNode[], replace: boolean) => {
    const wanted = replace ? nodes : nodes.filter((n) => !cardTextRef.current.has(n.id));
    if (wanted.length === 0 && !replace) return;
    const entries = await Promise.all(
      wanted.map(async (n) => {
        const detail = await vault.getNoteById(n.id).catch(() => null);
        return [n.id, { title: detail?.title ?? n.title, content: detail?.content ?? "" }, detail?.tagNames ?? []] as const;
      }),
    );
    if (!mountedRef.current) return;
    setCardText((prev) => {
      const next = new Map(replace ? [] : prev);
      for (const [id, text] of entries) next.set(id, text);
      return next;
    });
    setNoteTags((prev) => {
      const next = new Map(replace ? [] : prev);
      for (const [id, , tags] of entries) next.set(id, tags);
      return next;
    });
  }, []);

  const flushSave = useCallback(
    async (id: string): Promise<string[] | undefined> => {
      const timer = saveTimers.current.get(id);
      if (timer) clearTimeout(timer);
      saveTimers.current.delete(id);
      const pending = pendingSaves.current.get(id);
      pendingSaves.current.delete(id);
      if (!pending) return undefined;
      try {
        await vault.updateNote({ id, ...pending });
        const fresh = await vault.getNoteById(id);
        const tags = fresh?.tagNames;
        if (tags && mountedRef.current) setNoteTags((prev) => new Map(prev).set(id, tags));
        // A saved [[link]] is a new arrow.
        await refreshGraph();
        return tags;
      } catch {
        // The text stays in the card; the next edit retries the save.
        return undefined;
      }
    },
    [refreshGraph],
  );

  const flushAllSaves = useCallback(() => Promise.all(Array.from(pendingSaves.current.keys(), (id) => flushSave(id))), [flushSave]);

  // Notes can change while another tab or a note screen is in front, so
  // everything is read again on the way back in — nothing is being typed
  // here at that moment. Leaving writes out whatever is still waiting.
  useFocusEffect(
    useCallback(() => {
      refreshGraph().then((next) => loadCards(next.nodes, true));
      return () => {
        void flushAllSaves();
      };
    }, [refreshGraph, loadCards, flushAllSaves]),
  );

  // Cards created while the flow is open (New note, a link chip) arrive in
  // the graph first; their text follows.
  useEffect(() => {
    if (graph) void loadCards(graph.nodes, false);
  }, [graph, loadCards]);

  function scheduleSave(id: string, next: CardText) {
    pendingSaves.current.set(id, next);
    const existing = saveTimers.current.get(id);
    if (existing) clearTimeout(existing);
    saveTimers.current.set(
      id,
      setTimeout(() => void flushSave(id), SAVE_DEBOUNCE_MS),
    );
  }

  const editCard = useCallback(
    (id: string, patch: Partial<CardText>) => {
      const current = cardTextRef.current.get(id) ?? { title: "", content: "" };
      const next = { ...current, ...patch };
      setCardText((prev) => new Map(prev).set(id, next));
      scheduleSave(id, next);
    },
    [flushSave], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const onTitle = useCallback((id: string, value: string) => editCard(id, { title: value }), [editCard]);
  const onContent = useCallback((id: string, value: string) => editCard(id, { content: value }), [editCard]);

  const openNote = useCallback(
    async (id: string) => {
      await flushSave(id);
      router.push(`/vault/${id}`);
    },
    [flushSave, router],
  );

  async function changeType(id: string, type: NoteType) {
    setTypePickerId(null);
    // Text still waiting to be saved goes first, so the two writes can't cross.
    await flushSave(id);
    await vault.updateNote({ id, type });
    // The type decides the journal tag, so tags come back with it.
    const fresh = await vault.getNoteById(id);
    if (fresh && mountedRef.current) setNoteTags((prev) => new Map(prev).set(id, fresh.tagNames));
    await refreshGraph();
  }

  async function createCard() {
    const note = await vault.createNote({ title: "Untitled", content: "", type: "fleeting" });
    await refreshGraph();
    if (!mountedRef.current) return;
    // Pinned as "being edited" so it shows even under a tag filter it doesn't match.
    setEditingId(note.id);
    setActiveId(note.id);
    setFocusId(note.id);
  }

  const forgetPosition = useCallback((id: string) => {
    if (!movedRef.current.has(id)) return;
    const next = new Map(movedRef.current);
    next.delete(id);
    setMoved(next);
    void saveFlowPositions(next);
  }, []);

  const confirmDelete = useCallback(
    (id: string) => {
      Alert.alert(COPY.deleteNoteTitle, COPY.deleteNoteBody(cardTextRef.current.get(id)?.title ?? ""), [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // An edit still waiting to be saved must not land after the delete.
            const timer = saveTimers.current.get(id);
            if (timer) clearTimeout(timer);
            saveTimers.current.delete(id);
            pendingSaves.current.delete(id);
            await vault.deleteNote(id);
            if (!mountedRef.current) return;
            setCardText((prev) => {
              const next = new Map(prev);
              next.delete(id);
              return next;
            });
            setNoteTags((prev) => {
              const next = new Map(prev);
              next.delete(id);
              return next;
            });
            forgetPosition(id);
            await refreshGraph();
          },
        },
      ]);
    },
    [forgetPosition, refreshGraph],
  );

  // A link chip opens the note it names. A link to a note that doesn't exist
  // yet makes it right here on the flow, as the next card in the branch: it
  // starts with the tags of the card the link is in, so it stays in the same
  // tag-filtered view.
  const followLink = useCallback(
    async (fromId: string, title: string) => {
      const wanted = title.toLowerCase();
      const target = graphRef.current?.nodes.find((n) => (cardTextRef.current.get(n.id)?.title ?? n.title).toLowerCase() === wanted);
      if (target) {
        await openNote(target.id);
        return;
      }
      // A second tap before the first note lands must not make a twin.
      if (creatingLinks.current.has(wanted)) return;
      creatingLinks.current.add(wanted);
      try {
        // The link itself may still be waiting to be saved; it has to be in the
        // vault before the new note is, or no arrow would join the two.
        const tags = (await flushSave(fromId)) ?? noteTagsRef.current.get(fromId) ?? [];
        const note = await vault.createNote({ title, content: hashtagLine(tags), type: "fleeting" });
        await refreshGraph();
        if (mountedRef.current) setEditingId(note.id);
      } finally {
        creatingLinks.current.delete(wanted);
      }
    },
    [flushSave, openNote, refreshGraph],
  );

  // Put the cursor in a newly created card's title once the card is on screen.
  useEffect(() => {
    if (!focusId) return;
    const input = titleInputs.current.get(focusId);
    if (!input) return;
    input.focus();
    setFocusId(null);
  });

  const registerTitle = useCallback((id: string, input: TextInput | null) => {
    if (input) titleInputs.current.set(id, input);
    else titleInputs.current.delete(id);
  }, []);

  const nodes = useMemo(() => graph?.nodes ?? [], [graph]);
  const edges = useMemo(() => graph?.edges ?? [], [graph]);
  const tagOptions = useMemo(() => flowTagOptions(noteTags), [noteTags]);
  const journalCount = useMemo(() => nodes.filter((n) => n.type === "daily").length, [nodes]);
  const visibleNodes = useMemo(
    () => filterFlowNodes(nodes, noteTags, { filterTags, hideJournal, keepId: editingId }),
    [nodes, noteTags, filterTags, hideJournal, editingId],
  );
  const layout = useMemo(() => layoutFlow(visibleNodes, edges), [visibleNodes, edges]);
  const autoPositions = useMemo(() => flowAutoPositions(layout), [layout]);
  const positions = useMemo(() => placeFlowCards(autoPositions, moved), [autoPositions, moved]);
  const routes = useMemo(() => flowRoutes(edges, positions), [edges, positions]);
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const knownTitles = useMemo(() => new Set(nodes.map((n) => (cardText.get(n.id)?.title ?? n.title).toLowerCase())), [nodes, cardText]);

  // Android only delivers touches to children inside their parent's bounds,
  // so the surface is sized to hold every card rather than left at zero size
  // with the cards overflowing it.
  const bounds = useMemo(() => {
    const spots = Array.from(positions.values());
    if (spots.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    const minX = Math.min(...spots.map((p) => p.x)) - SURFACE_MARGIN;
    const minY = Math.min(...spots.map((p) => p.y)) - SURFACE_MARGIN;
    const maxX = Math.max(...spots.map((p) => p.x)) + FLOW_CARD.width + SURFACE_MARGIN;
    const maxY = Math.max(...spots.map((p) => p.y)) + FLOW_CARD.height + SURFACE_MARGIN;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [positions]);
  const origin = useMemo(() => ({ x: bounds.x, y: bounds.y }), [bounds.x, bounds.y]);

  // Start with the cards centred across the screen, as desktop does — and
  // zoomed out far enough to see the whole top row, since a phone is narrower
  // than two cards. Not below half size: smaller than that can't be read.
  useEffect(() => {
    if (centredRef.current || positions.size === 0 || size.width === 0) return;
    centredRef.current = true;
    const xs = Array.from(positions.values()).map((p) => p.x);
    const left = Math.min(...xs);
    const right = Math.max(...xs) + FLOW_CARD.width;
    const scale = Math.min(1, Math.max(0.5, size.width / (right - left + 48)));
    setView((v) => ({ ...v, scale, x: size.width / 2 - ((left + right) / 2) * scale }));
  }, [positions, size.width]);

  // Asking for the journal tag by name overrides "hide journal" — otherwise
  // the filter would promise journal entries and show none.
  function toggleTag(tag: string) {
    const next = filterTags.includes(tag) ? filterTags.filter((t) => t !== tag) : [...filterTags, tag];
    if (next.includes(JOURNAL_TAG)) setHideJournal(false);
    setFilterTags(next);
  }

  function toggleJournal() {
    if (!hideJournal) setFilterTags((current) => current.filter((t) => t !== JOURNAL_TAG));
    setHideJournal(!hideJournal);
  }

  function autoArrange() {
    setMoved(new Map());
    void saveFlowPositions(new Map());
  }

  const onDrag = useCallback((id: string, spot: FlowPoint) => setMoved((prev) => new Map(prev).set(id, spot)), []);
  const onDragEnd = useCallback(() => void saveFlowPositions(movedRef.current), []);

  // ---- Pan & pinch-zoom ----------------------------------------------------
  // Plain PanResponder, the same shape as the graph screen's: one finger pans,
  // two fingers pinch around their midpoint. A touch that barely moves is a
  // tap on empty space, which puts the keyboard away.
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

  // Where the surface sits on the screen, so a pinch can be measured from it.
  const surfaceRef = useRef<View>(null);
  const surfaceOffset = useRef({ x: 0, y: 0 });
  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
    surfaceRef.current?.measureInWindow((x, y) => {
      surfaceOffset.current = { x, y };
    });
  }

  if (!graph) return <View style={[styles.container, { backgroundColor: colors.bg }]} />;

  const filtering = filterTags.length > 0 || hideJournal;
  // Scaling happens around the surface's centre, so the shift that would
  // have put its top-left corner at the right place is worked out by hand.
  const translateX = view.x + bounds.x * view.scale - (bounds.width / 2) * (1 - view.scale);
  const translateY = view.y + bounds.y * view.scale - (bounds.height / 2) * (1 - view.scale);
  const pickerType = typePickerId ? nodesById.get(typePickerId)?.type : undefined;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.toolbar, { borderBottomWidth: shape.borderWidth, borderBottomColor: colors.line }]}>
        <View style={styles.toolbarRow}>
          <Button compact variant="primary" icon="plus" label={COPY.newNote} onPress={createCard} />
          <Button compact icon="layout" label="Auto-arrange" onPress={autoArrange} disabled={moved.size === 0} />
          {filtering && (
            <Text accessibilityLabel="Notes showing" style={{ fontFamily: MONO, fontSize: 11, color: colors.inkFaint, marginLeft: "auto" }}>
              {visibleNodes.length} of {nodes.length}
            </Text>
          )}
        </View>
        {(tagOptions.length > 0 || journalCount > 0) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.filterRow}>
            {journalCount > 0 && <Chip label={`Journal ${journalCount}`} active={!hideJournal} onPress={toggleJournal} />}
            {tagOptions.map((o) => (
              <Chip key={o.value} label={`${o.label} ${o.count}`} active={filterTags.includes(o.value)} onPress={() => toggleTag(o.value)} />
            ))}
          </ScrollView>
        )}
      </View>

      <View ref={surfaceRef} style={styles.surface} onLayout={onLayout} {...responder.panHandlers}>
        {layout.length === 0 ? (
          <View style={styles.empty}>
            <EmptyHint>{nodes.length === 0 ? COPY.emptyGraph : "No notes match the chosen tags."}</EmptyHint>
          </View>
        ) : (
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
            <Svg width={bounds.width} height={bounds.height} viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Defs>
                <Marker id="flow-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto">
                  <Path d="M 0 0 L 10 5 L 0 10 z" fill={colors.inkFaint} />
                </Marker>
                <Marker id="flow-arrow-active" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto">
                  <Path d="M 0 0 L 10 5 L 0 10 z" fill={colors.accent} />
                </Marker>
              </Defs>
              {routes.map((r) => {
                const lit = activeId !== null && (r.source === activeId || r.target === activeId);
                return (
                  <Path
                    key={`${r.source}-${r.target}`}
                    d={r.d}
                    fill="none"
                    stroke={lit ? colors.accent : colors.inkFaint}
                    strokeWidth={lit ? 2.5 : 1.5}
                    markerEnd={lit ? "url(#flow-arrow-active)" : "url(#flow-arrow)"}
                  />
                );
              })}
            </Svg>
            {layout.map((l) => {
              const node = nodesById.get(l.id);
              const position = positions.get(l.id);
              if (!node || !position) return null;
              return (
                <FlowCard
                  key={l.id}
                  node={node}
                  text={cardText.get(l.id)}
                  position={position}
                  origin={origin}
                  active={activeId === l.id}
                  fresh={focusId === l.id}
                  knownTitles={knownTitles}
                  scaleRef={scaleRef}
                  registerTitle={registerTitle}
                  onTouch={setActiveId}
                  onEditing={setEditingId}
                  onTitle={onTitle}
                  onContent={onContent}
                  onDrag={onDrag}
                  onDragEnd={onDragEnd}
                  onPickType={setTypePickerId}
                  onOpen={openNote}
                  onDelete={confirmDelete}
                  onLink={followLink}
                />
              );
            })}
          </View>
        )}
      </View>

      <Modal visible={typePickerId !== null} transparent animationType="fade" onRequestClose={() => setTypePickerId(null)}>
        <Pressable accessibilityLabel="Close type picker" style={styles.backdrop} onPress={() => setTypePickerId(null)}>
          <View
            accessibilityRole="radiogroup"
            style={[styles.typeSheet, { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: shape.borderWidth, borderRadius: shape.radius }]}
          >
            {NOTE_TYPES.map((t) => (
              <TypeBadge key={t.value} type={t.value} selected={pickerType === t.value} onPress={() => typePickerId && changeType(typePickerId, t.value)} />
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, gap: 8 },
  toolbarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterRow: { flexDirection: "row", gap: 6, paddingRight: 12 },
  surface: { flex: 1, overflow: "hidden" },
  empty: { flex: 1, padding: 24, justifyContent: "center" },
  card: { position: "absolute", width: FLOW_CARD.width, height: FLOW_CARD.height, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", height: 30, paddingRight: 4 },
  cardHandle: { flex: 1, alignSelf: "stretch", flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 10 },
  cardType: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, height: 30 },
  typeDot: { width: 7, height: 7, borderRadius: 4 },
  cardButton: { width: 26, height: 30, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700", paddingHorizontal: 10, paddingTop: 6, paddingBottom: 0 },
  cardBody: { flex: 1, fontSize: 12, lineHeight: 17, paddingHorizontal: 10, paddingTop: 2, paddingBottom: 6 },
  cardLinks: { flexGrow: 0, maxHeight: 26 },
  cardLinksContent: { flexDirection: "row", gap: 5, paddingHorizontal: 8, paddingBottom: 6 },
  linkChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, height: 20, borderRadius: 10 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 32 },
  typeSheet: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16 },
});
