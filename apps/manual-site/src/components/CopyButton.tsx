import { useState } from 'react';

type CopyButtonProps = {
  value: string;
};

async function copyText(value: string): Promise<boolean> {
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

export default function CopyButton({ value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const ok = await copyText(value);
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Swallow copy errors to avoid blocking UI.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="btn btn-secondary text-xs px-2 py-1"
      aria-label="Copy to clipboard"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
