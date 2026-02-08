import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
export const useCapabilitiesStore = create()(devtools((set) => ({
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
    setStudentMode: (enabled) => set({ studentMode: enabled }),
    updateHardwareStatus: (status) => set((state) => ({
        hardware: { ...state.hardware, ...status }
    })),
    setCapability: (key, enabled) => set((state) => ({
        [key]: { ...state[key], enabled }
    })),
}), { name: 'CapabilitiesStore' }));
