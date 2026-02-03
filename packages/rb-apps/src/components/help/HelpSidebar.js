import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from '@redbyte/rb-primitives';
/**
 * HelpSidebar - Track picker and lesson list
 * Two modes: track selection or lesson navigation
 */
export const HelpSidebar = ({ tracks, onSelectTrack, selectedTrack, lessons, currentLessonIndex, completedLessons, onSelectLesson, onBackToTracks, }) => {
    return (_jsxs("div", { children: [_jsx("h1", { className: "text-2xl mb-4 text-cyan-400", children: "Logic Help" }), _jsx("p", { className: "text-sm text-gray-400 mb-6", children: "Learn digital logic from gates to CPUs" }), !selectedTrack && tracks && onSelectTrack ? (
            // Track Selection Mode
            _jsxs("div", { children: [_jsx("h2", { className: "text-base mb-4", children: "Choose a Track:" }), tracks.map((track) => (_jsxs("button", { onClick: () => onSelectTrack(track.id), className: "w-full p-4 mb-3 bg-slate-800 border border-slate-700 rounded-md text-gray-200 cursor-pointer text-left transition-all hover:bg-slate-700 hover:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500", children: [_jsx("div", { className: "text-lg mb-1", children: track.title }), _jsx("div", { className: "text-xs text-gray-400", children: track.description })] }, track.id)))] })) : selectedTrack && lessons && onBackToTracks && onSelectLesson !== undefined ? (
            // Lesson Navigation Mode
            _jsxs("div", { children: [_jsx(Button, { onClick: onBackToTracks, variant: "ghost", size: "sm", className: "mb-4 border border-slate-700 text-cyan-400", children: "\u2190 Back to Tracks" }), _jsx("h2", { className: "text-base mb-4", children: selectedTrack.title }), _jsx("div", { children: lessons.map((lesson, index) => {
                            const isCompleted = completedLessons?.has(lesson.id);
                            const isCurrent = index === currentLessonIndex;
                            return (_jsx("div", { className: "mb-1", children: _jsxs("button", { onClick: () => onSelectLesson(index), className: `w-full px-3 py-2 rounded text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isCurrent
                                        ? 'bg-cyan-900/30 border border-cyan-500 text-cyan-300 font-medium'
                                        : 'text-gray-300 hover:bg-slate-700'}`, children: [_jsx("span", { className: "mr-2", children: isCompleted ? '✓' : '○' }), lesson.id, ": ", lesson.title] }) }, lesson.id));
                        }) })] })) : null] }));
};
