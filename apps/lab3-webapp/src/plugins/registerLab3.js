import { TruthTableEditor } from '../truth-table';
import { KMapViewer } from '../kmap-viewer-interactive';
import { CircuitEditor } from '../circuit-editor';
import { Simulator } from '../simulator';
import { WaveformViewer } from '../waveform-viewer-enhanced';
import { VerilogExporter } from '../verilog';
import { PdfExporter } from '../pdf-exporter';
import { OverviewView } from '../workspace/OverviewView';
import { ConsoleWindow } from '../workspace/ConsoleWindow';
import { InspectorWindow } from '../workspace/InspectorWindow';
/**
 * Register Lab 3 plugin with all views
 * Called once on app mount
 */
export function registerLab3(registry) {
    const lab3Views = [
        {
            pluginId: 'lab3',
            viewId: 'overview',
            title: 'Overview',
            icon: 'BookOpen',
            Component: OverviewView,
        },
        {
            pluginId: 'lab3',
            viewId: 'truth-table',
            title: 'Truth Table',
            icon: 'Table',
            Component: TruthTableEditor,
        },
        {
            pluginId: 'lab3',
            viewId: 'kmap',
            title: 'K-Maps',
            icon: 'Target',
            Component: KMapViewer,
        },
        {
            pluginId: 'lab3',
            viewId: 'circuit',
            title: 'Circuit',
            icon: 'Cpu',
            Component: CircuitEditor,
        },
        {
            pluginId: 'lab3',
            viewId: 'simulator',
            title: 'Simulator',
            icon: 'PlayCircle',
            Component: Simulator,
        },
        {
            pluginId: 'lab3',
            viewId: 'waveform',
            title: 'Waveform',
            icon: 'TrendingUp',
            Component: WaveformViewer,
        },
        {
            pluginId: 'lab3',
            viewId: 'verilog',
            title: 'Verilog',
            icon: 'FileCode',
            Component: VerilogExporter,
        },
        {
            pluginId: 'lab3',
            viewId: 'pdf',
            title: 'PDF Export',
            icon: 'Download',
            Component: PdfExporter,
        },
        {
            pluginId: 'lab3',
            viewId: 'console',
            title: 'Console',
            icon: 'TerminalSquare',
            Component: ConsoleWindow,
        },
        {
            pluginId: 'lab3',
            viewId: 'inspector',
            title: 'Inspector',
            icon: 'Eye',
            Component: InspectorWindow,
        },
    ];
    registry.registerPlugin('lab3', lab3Views);
}
