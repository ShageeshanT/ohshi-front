/** Assistant message renderer: GitHub-flavoured Markdown with copyable code blocks.
 *  Loaded lazily by ./Markdown.tsx so the markdown libraries stay out of the
 *  initial bundle (login / accounts / keys pages never need them). */

import { isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { copyText } from "../lib/api";

function textOf(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

function languageOf(node: ReactNode): string {
  const child = Array.isArray(node) ? node[0] : node;
  if (!isValidElement(child)) return "";
  const className = (child.props as { className?: string }).className ?? "";
  const match = /language-([\w+-]+)/.exec(className);
  return match ? match[1] : "";
}

function CodeBlock(props: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const language = languageOf(props.children);
  const copy = () => {
    void copyText(textOf(props.children).replace(/\n$/, "")).then((ok) => {
      setCopied(ok);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="codeblock">
      <div className="codeblock-bar">
        <span>{language || "code"}</span>
        <button type="button" onClick={copy} aria-label="Copy code">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{props.children}</pre>
    </div>
  );
}

export default function MarkdownRenderer(props: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: CodeBlock,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {props.text}
      </ReactMarkdown>
    </div>
  );
}
