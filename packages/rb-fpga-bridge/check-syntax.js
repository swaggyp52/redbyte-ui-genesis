
import RbBinV1Parser from './src/parsers/rb-bin-v1.js';
import { RedByteIngestion } from './src/ingestion.js';

console.log("Imports successful");

try {
    const p = new RbBinV1Parser();
    console.log("Parser instantiated");
} catch (e) {
    console.error("Parser Init Error:", e);
    process.exit(1);
}

try {
    const i = new RedByteIngestion({}, {});
    console.log("Ingestion instantiated");
} catch (e) {
    console.error("Ingestion Init Error:", e);
    process.exit(1);
}

console.log("Syntax Check Passed");
