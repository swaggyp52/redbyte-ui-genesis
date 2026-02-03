import { jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { HardwarePanelApp } from "../apps/HardwarePanelApp";
vi.setConfig({ hookTimeout: 20000, testTimeout: 20000 });
class FakeEventSource {
    url;
    onerror = null;
    listeners = {};
    constructor(url) {
        this.url = url;
    }
    addEventListener(type, cb) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(cb);
    }
    emit(type, data) {
        const event = { data: JSON.stringify(data) };
        (this.listeners[type] || []).forEach((cb) => cb(event));
    }
    close() {
        // no-op
    }
}
const Component = HardwarePanelApp.component;
describe("HardwarePanelApp", () => {
    beforeEach(() => {
        vi.stubGlobal("EventSource", FakeEventSource);
    });
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });
    it("shows bridge offline when health check fails", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => {
            throw new Error("offline");
        }));
        render(_jsx(Component, {}));
        await waitFor(() => {
            expect(screen.getByText(/Local Bridge not running/i)).toBeTruthy();
        });
        const startButton = screen.getByRole("button", { name: /Start Capture/i });
        expect(startButton).toBeDisabled();
    });
    it("calls stop on unmount after a run starts", async () => {
        const fetchMock = vi.fn(async (input) => {
            const url = typeof input === "string" ? input : input.toString();
            if (url.endsWith("/health")) {
                return { ok: true, status: 200, json: async () => ({ ok: true, version: "dev" }) };
            }
            if (url.endsWith("/devices")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        devices: [
                            {
                                id: "sim-1",
                                display_name: "Basys3 SIM",
                                model_id: "basys3",
                                transport: "sim",
                                runtime: { status: "ready" },
                                programming: { status: "ready" },
                            },
                        ],
                    }),
                };
            }
            if (url.endsWith("/run")) {
                return { ok: true, status: 200, json: async () => ({ ok: true, run_id: "run-1" }) };
            }
            if (url.endsWith("/stop")) {
                return { ok: true, status: 200, json: async () => ({ ok: true }) };
            }
            return { ok: true, status: 200, json: async () => ({ ok: true }) };
        });
        vi.stubGlobal("fetch", fetchMock);
        const { unmount } = render(_jsx(Component, {}));
        await waitFor(() => {
            expect(screen.getByText(/Basys3 SIM/i)).toBeTruthy();
        });
        const startButton = screen.getByRole("button", { name: /Start Capture/i });
        fireEvent.click(startButton);
        await waitFor(() => {
            expect(screen.getByText(/run_id: run-1/i)).toBeTruthy();
        });
        unmount();
        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/stop"), expect.objectContaining({ method: "POST" }));
        });
    });
});
