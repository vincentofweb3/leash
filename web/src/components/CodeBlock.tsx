import { CopyButton } from "./CopyButton";

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const text = code.trim();
  return (
    <div className="code-wrap">
      {label ? <div className="fine" style={{ marginBottom: 6 }}>{label}</div> : null}
      <pre className="code">
        <code>{text}</code>
      </pre>
      <CopyButton text={text} />
    </div>
  );
}
