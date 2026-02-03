import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
export const useCapabilitiesStore = create()(devtools(immer((set) => ({
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
        state[key].enabled = enabled;
    }),
})), { name: 'CapabilitiesStore' }));
