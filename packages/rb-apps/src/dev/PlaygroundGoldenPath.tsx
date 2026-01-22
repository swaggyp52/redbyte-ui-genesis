import React, { Suspense } from 'react';
import { LogicPlaygroundComponent } from '../apps/LogicPlaygroundApp';

// Stub props if strictly required, but LogicPlaygroundComponent seems to handle optional props well.
export function PlaygroundGoldenPath() {
    console.log("[GOLDEN_PATH] enabled");
    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#1e1e1e' }}>
            <Suspense fallback={<div style={{ color: 'white' }}>Loading Golden Path...</div>}>
                {/* 
            Mounting directly. 
            Passing dummy IDs to satisfy any potential internal checks, 
            though most props appear optional in the definition.
         */}
                <LogicPlaygroundComponent
                    windowId="golden-path-window"
                />
            </Suspense>
        </div>
    );
}
