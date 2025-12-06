export type AppId = string;

export const OS_APPS = [
    // TEMP PLACEHOLDER APP; replace with real apps later
    {
        id: "notes",
        label: "Notes",
        hint: "Simple notes module",
        component: () => "Notes App Loaded"
    }
];

export function loadApp(id: AppId) {
    const app = OS_APPS.find(a => a.id === id);
    return app?.component || (() => "Unknown App: " + id);
}
