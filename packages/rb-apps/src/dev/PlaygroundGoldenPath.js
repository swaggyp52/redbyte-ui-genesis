import { jsx as _jsx } from "react/jsx-runtime";
import { Suspense } from 'react';
import { LogicPlaygroundComponent } from '../apps/LogicPlaygroundApp';
// Stub props if strictly required, but LogicPlaygroundComponent seems to handle optional props well.
export function PlaygroundGoldenPath() {
    console.log("[GOLDEN_PATH] enabled");
    return (_jsx("div", { style: { width: '100vw', height: '100vh', overflow: 'hidden', background: '#1e1e1e' }, children: _jsx(Suspense, { fallback: _jsx("div", { style: { color: 'white' }, children: "Loading Golden Path..." }), children: _jsx(LogicPlaygroundComponent, { windowId: "golden-path-window" }) }) }));
}
