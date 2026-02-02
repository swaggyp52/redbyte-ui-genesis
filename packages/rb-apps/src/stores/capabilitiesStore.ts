import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface CapabilitiesState {
    studentMode: boolean;

    hardware: {
        enabled: boolean;
        bridgeOnline: boolean;
        connected: boolean;
        selectedPort: string | null;
        lastHeartbeatAt: number | null;
    };

    simulation: {
        enabled: boolean;
    };

    export: {
        enabled: boolean;
    };

    logic3d: {
        enabled: boolean;
    };

    // Actions
    setStudentMode: (enabled: boolean) => void;
    updateHardwareStatus: (status: Partial<CapabilitiesState['hardware']>) => void;
    setCapability: (key: keyof Omit<CapabilitiesState, 'hardware' | 'updateHardwareStatus' | 'setStudentMode' | 'setCapability'>, enabled: boolean) => void;
}

export const useCapabilitiesStore = create<CapabilitiesState>()(
    devtools(
        immer((set) => ({
            studentMode: true,

            hardware: {
                enabled: true,
                bridgeOnline: false,
                connected: false,
                selectedPort: null,
                lastHeartbeatAt: null,
            },

            simulation: {
                enabled: true,
            },

            export: {
                enabled: true,
            },

            logic3d: {
                enabled: false, // Default to false until implemented/wired
            },

            setStudentMode: (enabled) => set((state) => {
                state.studentMode = enabled;
            }),

            updateHardwareStatus: (status) => set((state) => {
                state.hardware = { ...state.hardware, ...status };
            }),

            setCapability: (key, enabled) => set((state) => {
                (state[key] as any).enabled = enabled;
            }),
        })),
        { name: 'CapabilitiesStore' }
    )
);
