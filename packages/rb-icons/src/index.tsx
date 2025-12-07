import React from "react";

const createIcon = (
  path: React.ReactNode,
  viewBox = "0 0 24 24",
): React.FC<React.SVGProps<SVGSVGElement>> => {
  const Icon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg role="img" viewBox={viewBox} fill="currentColor" aria-hidden={props["aria-label"] ? undefined : true} {...props}>
      {path}
    </svg>
  );
  Icon.displayName = "RbIcon";
  return Icon;
};

export const WindowCloseIcon = createIcon(
  <g>
    <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </g>,
);

export const WindowMaximizeIcon = createIcon(
  <rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />,"0 0 24 24",
);

export const WindowMinimizeIcon = createIcon(
  <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,"0 0 24 24",
);

export const TerminalIcon = createIcon(
  <g>
    <path d="M5 5h14v14H5z" stroke="currentColor" strokeWidth="2" fill="none" rx="2" />
    <path d="M8 9l3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </g>,
);

export const SettingsIcon = createIcon(
  <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8 4a7.96 7.96 0 0 0-.36-2.36l2.04-1.6-1.5-2.6-2.4 1a8.02 8.02 0 0 0-2.06-1.2l-.3-2.55h-3l-.3 2.55a8.02 8.02 0 0 0-2.06 1.2l-2.4-1-1.5 2.6 2.04 1.6A7.96 7.96 0 0 0 4 12c0 .82.12 1.6.36 2.36l-2.04 1.6 1.5 2.6 2.4-1c.61.5 1.31.9 2.06 1.2l.3 2.55h3l.3-2.55c.75-.3 1.45-.7 2.06-1.2l2.4 1 1.5-2.6-2.04-1.6c.24-.76.36-1.54.36-2.36z" />,
);

export const FilesIcon = createIcon(
  <path d="M9 3h5l4 4v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm4 1.5V8h3.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />,
);

export const LogicIcon = createIcon(
  <path d="M4 7h6l4 10h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
);

export const AndIcon = createIcon(
  <path d="M5 5h4l6 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
);

export const OrIcon = createIcon(
  <path d="M5 5s5 3 5 7-5 7-5 7h6c3 0 8-3 8-7s-5-7-8-7H5z" stroke="currentColor" strokeWidth="2" fill="none" />,
);

export const NotIcon = createIcon(
  <g>
    <path d="M6 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="17" cy="12" r="2" stroke="currentColor" strokeWidth="2" fill="none" />
  </g>,
);

export const XorIcon = createIcon(
  <g>
    <path d="M5 5s5 3 5 7-5 7-5 7h6c3 0 8-3 8-7s-5-7-8-7H5z" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M3 5s5 3 5 7-5 7-5 7" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </g>,
);

export const ClockIcon = createIcon(
  <g>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </g>,
);

export const WindowMinMaxIcon = WindowMaximizeIcon;
