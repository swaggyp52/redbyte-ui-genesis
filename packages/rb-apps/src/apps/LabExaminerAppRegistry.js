import { jsx as _jsx } from "react/jsx-runtime";
import LabExaminerApp from './LabExaminerApp';
const LabExaminerAppWrapper = ({ onClose }) => {
    return (_jsx("div", { style: { width: '100%', height: '100%', overflow: 'auto' }, children: _jsx(LabExaminerApp, {}) }));
};
export const LabExaminerAppRegistry = {
    manifest: {
        id: 'lab-examiner',
        name: 'Lab Examiner',
        iconId: 'microscope',
        singleton: false,
        category: 'tools',
        defaultSize: { width: 1200, height: 700 },
        minSize: { width: 800, height: 500 },
    },
    component: LabExaminerAppWrapper,
};
export default LabExaminerAppRegistry;
