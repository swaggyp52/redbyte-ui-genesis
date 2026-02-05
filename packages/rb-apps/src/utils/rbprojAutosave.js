import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { decodeRBProject, encodeRBProject } from "../export/projectFormat";
import { stableStringify } from "../export/stableStringify";
import { fnv1a32 } from "./fnv1a32";
const RBPROJ_AUTOSAVE_VERSION = 1;
const PROJECT_AUTOSAVE_META_VERSION = 1;
export function getRbprojAutosaveKey(appId, windowId) {
    const scope = windowId && String(windowId).trim().length > 0 ? windowId : "global";
    return `rb:rbproj_autosave:v${RBPROJ_AUTOSAVE_VERSION}:${appId}:${scope}`;
}
export function getCanonicalProjectAutosaveKey(projectId) {
    return `rb:autosave:${String(projectId).trim()}`;
}
export function getCanonicalProjectAutosaveMetaKey(projectId) {
    return `rb:autosave-meta:${String(projectId).trim()}`;
}
export function tryParseCanonicalProjectAutosaveKey(key) {
    const prefix = "rb:autosave:";
    if (!key.startsWith(prefix))
        return null;
    const projectId = key.slice(prefix.length).trim();
    if (!projectId)
        return null;
    return { projectId };
}
export function loadRbprojAutosave(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object")
            return null;
        if (parsed.version !== RBPROJ_AUTOSAVE_VERSION)
            return null;
        if (typeof parsed.projectJson !== "string")
            return null;
        if (typeof parsed.contentHash !== "string")
            return null;
        if (typeof parsed.savedAtMs !== "number")
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
export function loadProjectAutosaveMeta(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object")
            return null;
        if (parsed.version !== PROJECT_AUTOSAVE_META_VERSION)
            return null;
        if (parsed.codec !== "rbproj")
            return null;
        if (typeof parsed.projectId !== "string" || parsed.projectId.length === 0)
            return null;
        if (typeof parsed.savedAtMs !== "number")
            return null;
        if (typeof parsed.contentHash !== "string")
            return null;
        if (parsed.appSurface !== undefined && typeof parsed.appSurface !== "string")
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
export function saveRbprojAutosave(key, record) {
    try {
        localStorage.setItem(key, JSON.stringify(record));
    }
    catch {
        // ignore
    }
}
export function saveProjectAutosaveMeta(key, meta) {
    try {
        localStorage.setItem(key, JSON.stringify(meta));
    }
    catch {
        // ignore
    }
}
export function clearRbprojAutosave(key) {
    try {
        localStorage.removeItem(key);
    }
    catch {
        // ignore
    }
}
export function clearProjectAutosaveMeta(key) {
    try {
        localStorage.removeItem(key);
    }
    catch {
        // ignore
    }
}
export function migrateRbprojAutosaveIfNeeded(fromKey, toKey) {
    if (fromKey === toKey)
        return false;
    const existing = loadRbprojAutosave(toKey);
    if (existing)
        return false;
    const legacy = loadRbprojAutosave(fromKey);
    if (!legacy)
        return false;
    saveRbprojAutosave(toKey, legacy);
    return true;
}
export function normalizeRbprojForContentHash(project) {
    const { meta, updatedAt: _updatedAt, ...rest } = project;
    const metaSafe = meta ? { ...meta, appVersion: undefined, gitCommit: undefined } : undefined;
    return { ...rest, meta: metaSafe };
}
export function computeRbprojContentHashFromEncoded(projectJson) {
    const decoded = decodeRBProject(projectJson);
    const normalizedText = stableStringify(normalizeRbprojForContentHash(decoded)).replace(/\r\n/g, "\n");
    return fnv1a32(normalizedText);
}
export function buildRbprojAutosaveRecord(project) {
    const projectJson = encodeRBProject(project);
    const contentHash = computeRbprojContentHashFromEncoded(projectJson);
    return {
        version: RBPROJ_AUTOSAVE_VERSION,
        savedAtMs: Date.now(),
        contentHash,
        projectJson,
    };
}
function formatTimeLocal(ms) {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
}
export function useRbprojAutosave({ autosaveKey, isDirty, getProject, applyProject, changeDeps = [], intervalMs = 30_000, debounceMs = 1_500, }) {
    const lastSavedHashRef = useRef(null);
    const [saveStatusText, setSaveStatusText] = useState(undefined);
    const [restoreRecord, setRestoreRecord] = useState(null);
    const trySaveNow = useCallback(() => {
        const project = getProject();
        if (!project)
            return;
        const record = buildRbprojAutosaveRecord(project);
        if (record.contentHash === lastSavedHashRef.current)
            return;
        saveRbprojAutosave(autosaveKey, record);
        const canonical = tryParseCanonicalProjectAutosaveKey(autosaveKey);
        if (canonical) {
            saveProjectAutosaveMeta(getCanonicalProjectAutosaveMetaKey(canonical.projectId), {
                version: PROJECT_AUTOSAVE_META_VERSION,
                codec: "rbproj",
                projectId: canonical.projectId,
                savedAtMs: record.savedAtMs,
                contentHash: record.contentHash,
                appSurface: project.meta?.appSurface,
            });
        }
        lastSavedHashRef.current = record.contentHash;
        setSaveStatusText(`Autosaved ${formatTimeLocal(record.savedAtMs)}`);
    }, [autosaveKey, getProject]);
    useEffect(() => {
        let cancelled = false;
        let attempts = 0;
        const run = () => {
            if (cancelled)
                return;
            attempts += 1;
            const saved = loadRbprojAutosave(autosaveKey);
            if (!saved)
                return;
            const current = getProject();
            if (!current) {
                if (attempts < 20)
                    setTimeout(run, 100);
                return;
            }
            const currentHash = buildRbprojAutosaveRecord(current).contentHash;
            lastSavedHashRef.current = currentHash;
            if (saved.contentHash !== currentHash) {
                setRestoreRecord(saved);
                return;
            }
            setSaveStatusText(`Autosaved ${formatTimeLocal(saved.savedAtMs)}`);
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [autosaveKey]);
    useEffect(() => {
        if (!isDirty)
            return;
        const t = setTimeout(() => {
            trySaveNow();
        }, debounceMs);
        return () => clearTimeout(t);
    }, [isDirty, debounceMs, trySaveNow, ...changeDeps]);
    useEffect(() => {
        if (!isDirty)
            return;
        const id = setInterval(() => {
            trySaveNow();
        }, intervalMs);
        return () => clearInterval(id);
    }, [isDirty, intervalMs, trySaveNow]);
    const restore = useCallback(() => {
        if (!restoreRecord)
            return;
        try {
            const project = decodeRBProject(restoreRecord.projectJson);
            applyProject(project);
            lastSavedHashRef.current = restoreRecord.contentHash;
            setSaveStatusText(`Autosaved ${formatTimeLocal(restoreRecord.savedAtMs)}`);
            clearRbprojAutosave(autosaveKey);
            setRestoreRecord(null);
        }
        catch {
            // keep record
        }
    }, [applyProject, autosaveKey, restoreRecord]);
    const discard = useCallback(() => {
        clearRbprojAutosave(autosaveKey);
        setRestoreRecord(null);
    }, [autosaveKey]);
    const restorePrompt = useMemo(() => ({ isOpen: !!restoreRecord, savedAtMs: restoreRecord?.savedAtMs }), [restoreRecord]);
    return { saveStatusText, restorePrompt, restore, discard };
}
