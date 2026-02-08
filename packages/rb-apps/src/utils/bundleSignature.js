import JSZip from 'jszip';
import { buildCapsule, normalizeCapsulePath, TRUSTED_PUBLIC_KEYS_HEX, verifyCapsule } from '@redbyte/rb-fpga-signing';
function buffersEqual(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
export async function verifyBundleSignature(zipBytes) {
    const zip = await JSZip.loadAsync(zipBytes);
    const signatureFile = zip.file('integrity/signature.sig');
    if (!signatureFile)
        return 'Unsigned';
    const capsuleFile = zip.file('integrity/capsule.json');
    if (!capsuleFile)
        return 'Invalid';
    const [signature, capsuleBytes] = await Promise.all([
        signatureFile.async('uint8array'),
        capsuleFile.async('uint8array'),
    ]);
    const fileEntries = [];
    const reads = [];
    zip.forEach((relativePath, file) => {
        if (file.dir)
            return;
        const normalized = normalizeCapsulePath(relativePath);
        if (normalized === 'integrity/signature.sig' || normalized === 'integrity/capsule.json') {
            return;
        }
        reads.push(file.async('uint8array').then((bytes) => {
            fileEntries.push({ path: normalized, bytes });
        }));
    });
    await Promise.all(reads);
    const { capsuleJsonUtf8 } = await buildCapsule(fileEntries);
    if (!buffersEqual(capsuleJsonUtf8, capsuleBytes)) {
        return 'Invalid';
    }
    for (const key of TRUSTED_PUBLIC_KEYS_HEX) {
        if (!key)
            continue;
        const ok = await verifyCapsule(capsuleBytes, signature, key);
        if (ok)
            return 'Valid';
    }
    return 'Invalid';
}
