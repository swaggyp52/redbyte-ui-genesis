
// Script to verify parser robustness against noise, drops, and fragmentation.
import RbBinV1Parser from './src/parsers/rb-bin-v1.js';

const parser = new RbBinV1Parser();
let frameCount = 0;

parser.on('data', (evt) => {
    frameCount++;
});

parser.on('error', (err) => {
    // console.log("Expected Error:", err.message); 
});

console.log("=== Starting Robustness Test ===");

// 1. Clean Stream
console.log("Test 1: Clean Stream (100 frames)");
const cleanBuf = Buffer.alloc(1000);
for (let i = 0; i < 100; i++) {
    const offset = i * 10;
    cleanBuf[offset] = 0xAA;
    cleanBuf[offset + 1] = 0x55;
    cleanBuf[offset + 2] = i & 0xFF; // SEQ
    cleanBuf.writeUInt32BE(i * 1000, offset + 3); // TICK
    cleanBuf.writeUInt16BE(0x1234, offset + 7); // IO
    // Calc Checksum (XOR)
    let crc = 0;
    for (let j = 2; j < 9; j++) crc ^= cleanBuf[offset + j];
    cleanBuf[offset + 9] = crc;
}
parser.write(cleanBuf);
console.log(`Frames: ${frameCount}, CRC Errors: ${parser.stats.crcErrors}`);
if (frameCount !== 100) console.error("FAIL: Missed clean frames");

// 2. Corrupted Bits (Noise)
console.log("\nTest 2: Noise Injection (1 bad byte)");
const noiseBuf = Buffer.from(cleanBuf.slice(0, 10)); // One valid frame
noiseBuf[5] ^= 0xFF; // Flip a bit in the TICK field
parser.write(noiseBuf);
console.log(`Frames: ${frameCount}, CRC Errors: ${parser.stats.crcErrors}`);
if (parser.stats.crcErrors !== 1) console.error("FAIL: Did not detect CRC error");

// 3. Fragmentation (Byte by Byte)
console.log("\nTest 3: Fragmentation (Byte by Byte)");
const fragBuf = Buffer.from(cleanBuf.slice(0, 10)); // One valid frame
parser.write(fragBuf.slice(0, 5));
parser.write(fragBuf.slice(5));
console.log(`Frames: ${frameCount}, CRC Errors: ${parser.stats.crcErrors}`);
// Should be 100 (clean) + 1 (noise-dropped) + 1 (frag-recovered) = 101?
// Wait, Test 2 failed CRC, so no frame. FrameCount was 100.
// Test 3 adds 1 frame. Total 101.
if (frameCount !== 101) console.error(`FAIL: Reassembly failed (Count: ${frameCount})`);

// 4. Garbage between frames
console.log("\nTest 4: Garbage Resync");
const garbage = Buffer.from([0xDE, 0xAD, 0xBE, 0xEF, 0xAA, 0x55]);
const validFrame = cleanBuf.slice(0, 10);
// Send Garbage + Valid Frame
const streamWithGarbage = Buffer.concat([garbage, validFrame.slice(2)]);
parser.write(streamWithGarbage);
console.log(`Frames: ${frameCount}, Resyncs: ${parser.stats.resyncs}`);
// Total 102
if (frameCount !== 102) console.error(`FAIL: Resync failed (Count: ${frameCount})`);

console.log("\n=== Final Stats ===");
console.log(parser.stats);
