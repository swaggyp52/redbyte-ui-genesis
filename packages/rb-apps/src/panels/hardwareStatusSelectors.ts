
import { useLabStore } from '../internal/physicalLabModel';

export const useHardwareStatus = () => {
    const activeTransport = useLabStore((state) => state.activeTransport);
    const setTransport = useLabStore((state) => state.setTransport);
    const transportStatus = useLabStore((state) => state.activeTransport.getStatus());

    const detailedStatuses = activeTransport.getDetailedStatuses
        ? activeTransport.getDetailedStatuses()
        : { 'default': transportStatus };

    return {
        activeTransport,
        transportStatus,
        detailedStatuses,
        setTransport
    };
};
