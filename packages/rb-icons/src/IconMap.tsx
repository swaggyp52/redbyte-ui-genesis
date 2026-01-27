// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { TerminalIcon } from './TerminalIcon';
import { FilesIcon } from './FilesIcon';
import { SettingsIcon } from './SettingsIcon';
import { LogicIcon } from './LogicIcon';
import { NeonWaveIcon } from './NeonWaveIcon';
import { CpuIcon } from './CpuIcon';
import { ChipIcon } from './ChipIcon';
import { FolderIcon } from './FolderIcon';
import { DocumentIcon } from './DocumentIcon';
import { BrowserIcon } from './BrowserIcon';
import { WindowCloseIcon } from './WindowCloseIcon';
import { WindowMaximizeIcon } from './WindowMaximizeIcon';
import { WindowMinimizeIcon } from './WindowMinimizeIcon';
import { CodeIcon } from './CodeIcon';
import { CalculatorIcon } from './CalculatorIcon';
import { ImageIcon } from './ImageIcon';
import { MusicIcon } from './MusicIcon';
import { PowerButtonIcon } from './PowerButtonIcon';
import { AdderIcon } from './AdderIcon';
import { CounterIcon } from './CounterIcon';
import { ClockIcon } from './ClockIcon';
import { DelayIcon } from './DelayIcon';
import { FlipFlopIcon } from './FlipFlopIcon';
import { InputPortIcon } from './InputPortIcon';
import { LampIcon } from './LampIcon';
import { LatchIcon } from './LatchIcon';
import { LogicAndIcon } from './LogicAndIcon';
import { LogicNandIcon } from './LogicNandIcon';
import { LogicNorIcon } from './LogicNorIcon';
import { LogicNotIcon } from './LogicNotIcon';
import { LogicOrIcon } from './LogicOrIcon';
import { LogicXnorIcon } from './LogicXnorIcon';
import { LogicXorIcon } from './LogicXorIcon';
import { OutputPortIcon } from './OutputPortIcon';
import { SwitchIcon } from './SwitchIcon';
import { GridIcon } from './GridIcon';
import { SearchIcon } from './SearchIcon';
import { FileTextIcon } from './FileTextIcon';
import { BookIcon } from './BookIcon';
import { MicroscopeIcon } from './MicroscopeIcon';
import { CircuitBoardIcon } from './CircuitBoardIcon';
import { LogIcon } from './LogIcon';
import { KeyboardIcon } from './KeyboardIcon';

export const IconMap = {
  terminal: TerminalIcon,
  files: FilesIcon,
  settings: SettingsIcon,
  logic: LogicIcon,
  'neon-wave': NeonWaveIcon,
  cpu: CpuIcon,
  chip: ChipIcon,
  folder: FolderIcon,
  document: DocumentIcon,
  browser: BrowserIcon,
  'window-close': WindowCloseIcon,
  'window-maximize': WindowMaximizeIcon,
  'window-minimize': WindowMinimizeIcon,
  code: CodeIcon,
  calculator: CalculatorIcon,
  image: ImageIcon,
  music: MusicIcon,
  power: PowerButtonIcon,
  grid: GridIcon,
  search: SearchIcon,
  'file-text': FileTextIcon,
  book: BookIcon,
  microscope: MicroscopeIcon,
  'circuit-board': CircuitBoardIcon,
  log: LogIcon,
  keyboard: KeyboardIcon,
  // Logic components
  adder: AdderIcon,
  counter: CounterIcon,
  clock: ClockIcon,
  delay: DelayIcon,
  'flip-flop': FlipFlopIcon,
  'input-port': InputPortIcon,
  lamp: LampIcon,
  latch: LatchIcon,
  'logic-and': LogicAndIcon,
  'logic-nand': LogicNandIcon,
  'logic-nor': LogicNorIcon,
  'logic-not': LogicNotIcon,
  'logic-or': LogicOrIcon,
  'logic-xnor': LogicXnorIcon,
  'logic-xor': LogicXorIcon,
  'output-port': OutputPortIcon,
  switch: SwitchIcon,
} as const;

export type IconName = keyof typeof IconMap;
export type IconSize = 16 | 20 | 24;

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  size?: IconSize;
  title?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 20, title, ...props }) => {
  const Component = IconMap[name];
  if (!Component) return null;

  return (
    <Component
      width={size}
      height={size}
      aria-hidden={props['aria-label'] ? undefined : true}
      focusable="false"
      role={props['aria-label'] ? 'img' : 'presentation'}
      title={title}
      {...props}
    />
  );
};
