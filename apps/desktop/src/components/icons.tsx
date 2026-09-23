import { ICONS, type IconName } from "@simplekasten/core";
import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "ref" | "name">;

// The glyphs themselves live in @simplekasten/core so mobile draws the exact
// same set — this file only turns that geometry into web SVG. Purely
// decorative: every icon is used alongside real text or an aria-label,
// never as the only accessible label for a control.
export function Icon({ name, ...props }: IconProps & { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {ICONS[name].map((shape, i) => {
        if (shape.kind === "path") return <path key={i} d={shape.d} />;
        if (shape.kind === "circle") return <circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} />;
        return <rect key={i} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />;
      })}
    </svg>
  );
}

const named = (name: IconName) => (p: IconProps) => <Icon name={name} {...p} />;

export const SearchIcon = named("search");
export const PlusIcon = named("plus");
export const NetworkIcon = named("network");
export const DownloadIcon = named("download");
export const HashIcon = named("hash");
export const XIcon = named("x");
export const FileTextIcon = named("fileText");
export const LayersIcon = named("layers");
export const ChevronDownIcon = named("chevronDown");
export const LinkIcon = named("link");
export const SettingsIcon = named("settings");
export const TrashIcon = named("trash");
export const PaperclipIcon = named("paperclip");
export const CalendarIcon = named("calendar");
export const ChevronLeftIcon = named("chevronLeft");
export const ChevronRightIcon = named("chevronRight");
export const RepeatIcon = named("repeat");
export const CheckIcon = named("check");
