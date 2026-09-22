import { ICONS, type IconName } from "@simplekasten/core";
import { Circle, Path, Rect, Svg } from "react-native-svg";

// The glyphs live in @simplekasten/core so desktop draws the exact same set —
// this only turns that geometry into react-native-svg elements.
export function Icon({ name, size = 16, color }: { name: IconName; size?: number; color: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {ICONS[name].map((shape, i) => {
        if (shape.kind === "path") return <Path key={i} d={shape.d} />;
        if (shape.kind === "circle") return <Circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} />;
        return <Rect key={i} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />;
      })}
    </Svg>
  );
}
