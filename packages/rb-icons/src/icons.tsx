import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement>;

const createIcon = (path: JSX.Element): ((props: IconProps) => JSX.Element) => {
  const Icon = (props: IconProps): JSX.Element => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      role="img"
      {...props}
    >
      {path}
    </svg>
  );

  return Icon;
};

export const WindowCloseIcon = createIcon(
  <path d="M6.7 6.7a1 1 0 0 1 1.4 0L12 10.6l3.9-3.9a1 1 0 1 1 1.4 1.4L13.4 12l3.9 3.9a1 1 0 1 1-1.4 1.4L12 13.4l-3.9 3.9a1 1 0 0 1-1.4-1.4L10.6 12 6.7 8.1a1 1 0 0 1 0-1.4Z" />,
);

export const WindowMaximizeIcon = createIcon(
  <path d="M5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Zm2 0v10h10V7Zm2 2h6v6H9Z" />,
);

export const WindowMinimizeIcon = createIcon(<path d="M6 12.75a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H6.75A.75.75 0 0 1 6 12.75Z" />);

export const DockIcon = createIcon(
  <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v11A2.5 2.5 0 0 1 16.5 20h-9A2.5 2.5 0 0 1 5 17.5Zm2.5-1a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-11a1 1 0 0 0-1-1Zm1 2.5h2.5a1 1 0 1 1 0 2H8.5a1 1 0 1 1 0-2Zm0 4.5h7a1 1 0 1 1 0 2h-7a1 1 0 1 1 0-2Z" />,
);

export const TaskbarIcon = createIcon(
  <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v7A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5Zm2.5-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1Zm.75 1.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1 0-1.5Zm0 3h7a.75.75 0 0 1 0 1.5h-7a.75.75 0 0 1 0-1.5Z" />,
);

export const AndGateIcon = createIcon(
  <path d="M5 5.75a.75.75 0 0 1 .75-.75H12c3.46 0 6.25 2.79 6.25 6.25S15.46 17.5 12 17.5H5.75A.75.75 0 0 1 5 16.75Zm1.5.75v10h5.5a4.75 4.75 0 0 0 0-9.5Z" />,
);

export const OrGateIcon = createIcon(
  <path d="M5.22 6.02a.75.75 0 0 1 .86-.19c2.71 1.2 4.7 3.05 6.28 5.09 1.12 1.45 2.05 3 2.83 4.54a.75.75 0 0 1-1.34.66 21.1 21.1 0 0 0-2.63-4.19c-1.43-1.85-3.16-3.48-5.47-4.5V17a.75.75 0 0 1-1.5 0V6.52a.75.75 0 0 1 .97-.5Z" />,
);

export const NotGateIcon = createIcon(
  <path d="M6.25 5.75a.75.75 0 0 1 1.08-.67l9.5 4.75a.75.75 0 0 1 0 1.34l-9.5 4.75A.75.75 0 0 1 6 15.25V8.75a.75.75 0 0 1 .25-.56Zm1.25 2.18v6.14L15.3 12ZM18 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />,
);

export const XorGateIcon = createIcon(
  <path d="M7.59 6.2a.75.75 0 0 1 .54.9 19 19 0 0 0-.38 3.65c0 1.53.13 2.68.38 3.65a.75.75 0 0 1-1.45.36A11 11 0 0 1 6.8 10.75c0-1.25.12-2.52.38-3.9a.75.75 0 0 1 .41-.55Zm2.5 0a.75.75 0 0 1 .54.9 19 19 0 0 0-.38 3.65c0 1.53.13 2.68.38 3.65a.75.75 0 1 1-1.45.36 11 11 0 0 1-.5-3.01c0-1.25.12-2.52.38-3.9a.75.75 0 0 1 .41-.55Zm2.16-.15c3.06 1.32 5 3.4 6.52 5.76a.75.75 0 0 1 0 .78c-1.52 2.36-3.46 4.44-6.52 5.76a.75.75 0 0 1-1.09-.67V6.72a.75.75 0 0 1 1.09-.67Zm.91 1.9v6.1c1.74-.9 3.1-2.15 4.3-3.95-1.2-1.8-2.56-3.05-4.3-3.95Z" />,
);

export const NandGateIcon = createIcon(
  <path d="M5 5.75a.75.75 0 0 1 .75-.75H12c3.46 0 6.25 2.79 6.25 6.25S15.46 17.5 12 17.5H5.75A.75.75 0 0 1 5 16.75Zm1.5.75v10h5.5a4.75 4.75 0 0 0 0-9.5Zm10.25 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />,
);

export const NorGateIcon = createIcon(
  <path d="M5.22 6.02a.75.75 0 0 1 .86-.19c2.71 1.2 4.7 3.05 6.28 5.09 1.12 1.45 2.05 3 2.83 4.54a.75.75 0 1 1-1.34.66 21.1 21.1 0 0 0-2.63-4.19c-1.43-1.85-3.16-3.48-5.47-4.5V17a.75.75 0 0 1-1.5 0V6.52a.75.75 0 0 1 .97-.5Zm11.53 5.98a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />,
);

export const BufferIcon = createIcon(
  <path d="M6.25 5.75a.75.75 0 0 1 1.08-.67l9.5 4.75a.75.75 0 0 1 0 1.34l-9.5 4.75A.75.75 0 0 1 6 15.25V8.75a.75.75 0 0 1 .25-.56Zm1.25 2.18v6.14L15.3 12ZM18 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />,
);
