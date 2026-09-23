// Geometry for the app's hand-rolled stroke icon set (24x24 viewBox, 1.75px
// stroke, round caps and joins). It's plain data so desktop (web SVG) and
// mobile (react-native-svg) draw exactly the same glyphs — each app only
// owns the few lines that turn a shape into an element.

export type IconShape =
  | { kind: "path"; d: string }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx?: number };

const path = (d: string): IconShape => ({ kind: "path", d });
const circle = (cx: number, cy: number, r: number): IconShape => ({ kind: "circle", cx, cy, r });
const rect = (x: number, y: number, width: number, height: number, rx?: number): IconShape => ({ kind: "rect", x, y, width, height, rx });

export const ICONS = {
  search: [circle(11, 11, 7), path("M21 21l-4.3-4.3")],
  plus: [path("M12 5v14M5 12h14")],
  network: [circle(12, 5, 2.2), circle(5, 19, 2.2), circle(19, 19, 2.2), path("M12 7.2V13m0 0l-5.7 4.3M12 13l5.7 4.3")],
  download: [path("M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5"), path("M4 18v2a1 1 0 001 1h14a1 1 0 001-1v-2")],
  hash: [path("M5 9h14M5 15h14M10 3L7 21M17 3l-3 18")],
  x: [path("M18 6L6 18M6 6l12 12")],
  fileText: [path("M7 3h7l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"), path("M14 3v4h4M9 13h6M9 17h6")],
  layers: [path("M12 3l8 4.5-8 4.5-8-4.5L12 3z"), path("M4 12l8 4.5 8-4.5M4 16.5L12 21l8-4.5")],
  chevronDown: [path("M6 9l6 6 6-6")],
  link: [path("M9.5 14.5l5-5"), path("M11 6.5l1.4-1.4a3.5 3.5 0 015 5L16 11.5M13 17.5L11.6 18.9a3.5 3.5 0 01-5-5L8 12.5")],
  settings: [
    circle(12, 12, 3),
    path(
      "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
    ),
  ],
  camera: [path("M4 8.5a1.5 1.5 0 011.5-1.5h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0120 8.5V18a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18V8.5z"), circle(12, 13, 3.5)],
  image: [rect(3.5, 4.5, 17, 15, 1.5), circle(9, 10, 1.8), path("M20.5 16l-5-5-9 8.5")],
  mic: [rect(9, 3, 6, 11, 3), path("M5.5 11a6.5 6.5 0 0013 0M12 17.5V21")],
  stop: [rect(6.5, 6.5, 11, 11, 1.5)],
  play: [path("M8 5.5v13l10.5-6.5L8 5.5z")],
  pause: [path("M9 5.5v13M15 5.5v13")],
  trash: [path("M4.5 7h15M10 11v6M14 11v6"), path("M6 7l1 12.5a1.5 1.5 0 001.5 1.5h7a1.5 1.5 0 001.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V7")],
  paperclip: [path("M20 11.5l-7.8 7.8a5 5 0 01-7-7l8-8a3.3 3.3 0 014.7 4.7l-8 8a1.7 1.7 0 01-2.4-2.4l7.4-7.4")],
  calendar: [rect(4, 5.5, 16, 15, 1.5), path("M4 10h16M8 3v4M16 3v4"), circle(12, 14.5, 1.4)],
  chevronLeft: [path("M15 6l-6 6 6 6")],
  chevronRight: [path("M9 6l6 6-6 6")],
  repeat: [path("M17 2l4 4-4 4"), path("M3 11V9a4 4 0 014-4h14"), path("M7 22l-4-4 4-4"), path("M21 13v2a4 4 0 01-4 4H3")],
  check: [path("M20 6L9 17l-5-5")],
} satisfies Record<string, IconShape[]>;

export type IconName = keyof typeof ICONS;
