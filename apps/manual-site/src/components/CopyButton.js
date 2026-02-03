import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
async function copyText(value) {
    if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
}
export default function CopyButton({ value }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            const ok = await copyText(value);
            if (!ok)
                return;
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        }
        catch {
            // Swallow copy errors to avoid blocking UI.
        }
    };
    return (_jsx("button", { type: "button", onClick: handleCopy, className: "btn btn-secondary text-xs px-2 py-1", "aria-label": "Copy to clipboard", children: copied ? 'Copied' : 'Copy' }));
}
