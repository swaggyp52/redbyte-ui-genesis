import { describe, expect, it } from "vitest";
import { generateWrapperVerilog } from "../src/wrapper";
import { RBHB_MAGIC_HEADER_Val } from "../src/protocol";
describe("Protocol Golden Fixtures", () => {
    it("generates wrapper with correct RBHB magic header", () => {
        const options = {
            boardModelId: "basys3",
            studentTop: "student_top",
            pinmapHash: "sha256:dummy",
            designHash: "sha256:design",
            buildId: "build-123",
            clockHz: 100000000,
        };
        const wrapper = generateWrapperVerilog(options);
        // Check for Magic Header 0x52424842
        // The wrapper logic converts this to 32'h52424842
        const expectedMagic = "32'h" + RBHB_MAGIC_HEADER_Val.toString(16);
        expect(wrapper).toContain(expectedMagic);
    });
    it("generates wrapper with constant determinism (Snapshot)", () => {
        const options = {
            boardModelId: "basys3",
            studentTop: "student_top",
            pinmapHash: "sha256:dummy",
            designHash: "sha256:design",
            buildId: "build-123",
            clockHz: 100000000,
        };
        // We expect this output to be exactly stable.
        const wrapper = generateWrapperVerilog(options);
        expect(wrapper).toMatchSnapshot();
    });
});
