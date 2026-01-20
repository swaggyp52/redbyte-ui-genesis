import CopyButton from './CopyButton';

type CodeBlockProps = {
  code: string;
  copyText?: string;
};

export default function CodeBlock({ code, copyText }: CodeBlockProps) {
  const value = copyText ?? code;

  return (
    <div className="bg-rb-raised border border-rb-border rounded-md p-4 overflow-x-auto relative pr-16">
      <div className="absolute top-3 right-3">
        <CopyButton value={value} />
      </div>
      <pre className="text-sm text-rb-text font-mono whitespace-pre-wrap">
        <code>{code}</code>
      </pre>
    </div>
  );
}
