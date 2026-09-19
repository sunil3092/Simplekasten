import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "ref">;

// Small, hand-rolled stroke icon set (24x24, 1.75px stroke) so the app has a
// consistent, modern icon language without pulling in an icon-library
// dependency for a dozen glyphs. Purely decorative — every icon is used
// alongside real text, never as the only accessible label for a control.
function Icon({ children, ...props }: IconProps) {
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
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const NetworkIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="5" r="2.2" />
    <circle cx="5" cy="19" r="2.2" />
    <circle cx="19" cy="19" r="2.2" />
    <path d="M12 7.2V13m0 0l-5.7 4.3M12 13l5.7 4.3" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5" />
    <path d="M4 18v2a1 1 0 001 1h14a1 1 0 001-1v-2" />
  </Icon>
);

export const LogOutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 21H5a1 1 0 01-1-1V4a1 1 0 011-1h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </Icon>
);

export const HashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 9h14M5 15h14M10 3L7 21M17 3l-3 18" />
  </Icon>
);

export const XIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </Icon>
);

export const FileTextIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 3h7l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
    <path d="M14 3v4h4M9 13h6M9 17h6" />
  </Icon>
);

export const LayersIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l8 4.5-8 4.5-8-4.5L12 3z" />
    <path d="M4 12l8 4.5 8-4.5M4 16.5L12 21l8-4.5" />
  </Icon>
);

export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12.3l2.3 2.3 4.7-4.7" />
  </Icon>
);

export const LoaderIcon = (p: IconProps) => (
  <Icon className="animate-spin" {...p}>
    <path d="M12 3v3.5M12 17.5V21M5.6 5.6l2.5 2.5M15.9 15.9l2.5 2.5M3 12h3.5M17.5 12H21M5.6 18.4l2.5-2.5M15.9 8.1l2.5-2.5" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 14.5l5-5" />
    <path d="M11 6.5l1.4-1.4a3.5 3.5 0 015 5L16 11.5M13 17.5L11.6 18.9a3.5 3.5 0 01-5-5L8 12.5" />
  </Icon>
);

export const MailIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.5 6.5L12 13l8.5-6.5" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" />
    <path d="M8 10.5V7.5a4 4 0 018 0v3" />
  </Icon>
);

export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20a7.5 7.5 0 0115 0" />
  </Icon>
);

export const AlertCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v4.5M12 16h.01" />
  </Icon>
);

export const BookOpenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5.5c-1.6-1-4.5-1.5-7-1.2v13c2.5-.3 5.4.2 7 1.2 1.6-1 4.5-1.5 7-1.2v-13c-2.5-.3-5.4.2-7 1.2z" />
    <path d="M12 5.5v13" />
  </Icon>
);

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Icon>
);
