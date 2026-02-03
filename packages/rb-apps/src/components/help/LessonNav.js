import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from '@redbyte/rb-primitives';
/**
 * LessonNav - Navigation controls for moving between lessons
 * Provides Previous/Next buttons and completion marking
 */
export const LessonNav = ({ currentIndex, totalLessons, onPrevious, onNext, onMarkComplete, isCompleted, className = '', }) => {
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === totalLessons - 1;
    return (_jsxs("div", { className: `flex justify-between items-center pt-6 mt-8 border-t border-slate-700 ${className}`, children: [_jsx("div", { children: !isFirst && onPrevious && (_jsx(Button, { onClick: onPrevious, variant: "secondary", size: "md", children: "\u2190 Previous" })) }), _jsxs("div", { className: "flex gap-3", children: [onMarkComplete && (_jsx(Button, { onClick: onMarkComplete, variant: isCompleted ? 'ghost' : 'primary', size: "md", className: isCompleted ? 'text-green-400 border-green-500' : '', children: isCompleted ? '✓ Completed' : 'Mark Complete' })), !isLast && onNext && (_jsx(Button, { onClick: onNext, variant: "primary", size: "md", children: "Next \u2192" }))] })] }));
};
