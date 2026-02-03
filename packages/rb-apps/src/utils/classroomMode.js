// Classroom mode resolver: env var or URL param
export function useClassroomMode() {
    if (typeof window === 'undefined')
        return false;
    const envMode = process.env.VITE_CLASSROOM_MODE === '1';
    const queryParam = new URLSearchParams(window.location.search).get('mode') === 'classroom';
    return envMode || queryParam;
}
export function getClassroomMode() {
    if (typeof window === 'undefined')
        return false;
    const envMode = process.env.VITE_CLASSROOM_MODE === '1';
    const queryParam = new URLSearchParams(window.location.search).get('mode') === 'classroom';
    return envMode || queryParam;
}
