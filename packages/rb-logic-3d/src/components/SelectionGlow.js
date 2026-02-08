import { jsx as _jsx } from "react/jsx-runtime";
import { Edges } from '@react-three/drei';
export const SelectionGlow = ({ isSelected, isHovered }) => {
    if (!isSelected && !isHovered)
        return null;
    const color = isSelected ? '#D4930D' : '#22D3EE'; // Amber for selected, teal for hover
    const scale = isSelected ? 1.15 : 1.08;
    const linewidth = isSelected ? 3 : 2;
    return (_jsx(Edges, { scale: scale, threshold: 15, color: color, linewidth: linewidth }));
};
