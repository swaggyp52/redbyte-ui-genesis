import { LayoutMode } from '../context/SettingsContext';

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SnapResult {
    x: number;
    y: number;
    width: number;
    height: number;
    snapped: boolean;
}

const SIDEBAR_WIDTH = 260;
const SNAP_THRESHOLD = 32;

export function smartSnapPosition(
    rect: Rect,
    layoutMode: LayoutMode
): SnapResult {
    if (layoutMode === 'freeform') {
        return { ...rect, snapped: false };
    }

    const maxW = window.innerWidth;
    const maxH = window.innerHeight;

    let newX = rect.x;
    let newY = rect.y;
    let snapped = false;

    // ---- Prevent window from overlapping sidebar ----
    if (newX < SIDEBAR_WIDTH + 8) {
        newX = SIDEBAR_WIDTH + 8;
        snapped = true;
    }

    // ---- Snap left edge ----
    if (Math.abs(rect.x - SIDEBAR_WIDTH) < SNAP_THRESHOLD) {
        newX = SIDEBAR_WIDTH;
        snapped = true;
    }

    // ---- Snap right edge ----
    const rightEdge = rect.x + rect.width;
    if (Math.abs(maxW - rightEdge) < SNAP_THRESHOLD) {
        newX = maxW - rect.width;
        snapped = true;
    }

    // ---- Snap top edge ----
    if (Math.abs(rect.y - 40) < SNAP_THRESHOLD) {
        newY = 40;
        snapped = true;
    }

    // ---- Snap bottom edge ----
    if (Math.abs(maxH - (rect.y + rect.height)) < SNAP_THRESHOLD) {
        newY = maxH - rect.height;
        snapped = true;
    }

    return {
        x: newX,
        y: newY,
        width: rect.width,
        height: rect.height,
        snapped,
    };
}
