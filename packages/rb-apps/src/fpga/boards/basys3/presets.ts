import minimalLedsRaw from './presets/basys3-minimal-leds.xdc?raw';
import switchesLeds7segRaw from './presets/basys3-switches-leds-7seg.xdc?raw';

export type Basys3XdcPresetId = 'basys3-minimal-leds' | 'basys3-switches-leds-7seg';

function normalizeXdcText(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized.endsWith('\n') ? normalized : `${normalized}\n`;
}

export const basys3XdcPresets: Array<{ id: Basys3XdcPresetId; label: string; text: string }> = [
  { id: 'basys3-minimal-leds', label: 'Basys 3 - Minimal LEDs', text: normalizeXdcText(minimalLedsRaw) },
  {
    id: 'basys3-switches-leds-7seg',
    label: 'Basys 3 - Switches + LEDs + 7-Seg',
    text: normalizeXdcText(switchesLeds7segRaw),
  },
];

export function getBasys3XdcPresetText(presetId: Basys3XdcPresetId): string {
  const preset = basys3XdcPresets.find((p) => p.id === presetId);
  return preset ? preset.text : '';
}
