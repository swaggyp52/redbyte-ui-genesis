
import { SerialPort } from 'serialport';

async function list() {
    console.log("Scanning...");
    const ports = await SerialPort.list();
    if (ports.length === 0) console.log("No ports found.");
    ports.forEach(p => {
        console.log(`PATH: ${p.path}`);
        console.log(`  MANUFACTURER: ${p.manufacturer}`);
        console.log(`  SERIAL: ${p.serialNumber}`);
        console.log(`  PNP: ${p.pnpId}`);
        console.log(`  VENDOR: ${p.vendorId}`);
        console.log(`  PRODUCT: ${p.productId}`);
        console.log("------------------------------------------------");
    });
}
list();
