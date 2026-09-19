import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/components/ThemeProvider";

/**
 * React Native has no blur-free offset box-shadow, so a themed hard shadow is
 * a coloured view offset behind the content. The wrapper reserves the offset
 * as padding so nothing overlaps neighbouring layout.
 */
export function HardShadow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { shape } = useTheme();
  const shadow = shape.shadow;
  if (!shadow) return <View style={style}>{children}</View>;

  return (
    <View style={[style, { paddingRight: shadow.x, paddingBottom: shadow.y }]}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: shadow.x,
          top: shadow.y,
          right: 0,
          bottom: 0,
          backgroundColor: shadow.color,
          borderRadius: shape.radius,
        }}
      />
      {children}
    </View>
  );
}
