/** A file the model wrote in its reply (see lib/files.ts): what it is, a
 *  Download button — in its own format, or any other it can become — and a
 *  preview of what the model wrote. While the reply streams the card says the
 *  file is being written; the download exists once the reply is saved. */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, Eye, EyeOff, FileCode2, FileSpreadsheet, FileText, Loader2, Presentation } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Markdown from "./Markdown";
import { Badge, IconButton } from "./ui";
import { downloadFile, friendly } from "../lib/api";
import { canonicalExt, familyOf, formatName, kindLabel, measure, targetsOf, type FileBlock } from "../lib/files";

function look(block: FileBlock): { icon: LucideIcon; tone: string } {
  const ext = canonicalExt(block.ext);
  switch (familyOf(block)) {
    case "document":
      if (ext === "pdf") return { icon: FileText, tone: "bg-danger-soft text-danger" };
      if (ext === "docx") return { icon: FileText, tone: "bg-accent-soft text-accent" };
      return { icon: FileText, tone: "bg-ink/[0.06] text-ink-dim" };
    case "slides":
      return { icon: Presentation, tone: "bg-warn-soft text-warn" };
    case "sheet":
      return { icon: FileSpreadsheet, tone: "bg-ok-soft text-ok" };
    default:
      return { icon: FileCode2, tone: "bg-violet-soft text-violet" };
  }
}

export default function FileCard(props: {
  block: FileBlock;
  /** The download URL for a format; null while there is nothing to download yet. */
  url: ((format?: string) => string) | null;
  /** The model is still writing this file. */
  writing?: boolean;
  /** The reply stopped before the file was finished. */
  incomplete?: boolean;
}) {
  const { block } = props;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const [preview, setPreview] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { icon: Icon, tone } = look(block);
  const [own, ...others] = targetsOf(block);
  const ready = Boolean(props.url) && !props.writing;
  const family = familyOf(block);

  useEffect(() => {
    if (!menu) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const download = async (format: string) => {
    if (!props.url || busy) return;
    setMenu(false);
    setBusy(format);
    setError("");
    try {
      const stem = block.name.slice(0, block.name.length - block.ext.length - 1) || "file";
      await downloadFile(props.url(format === own ? undefined : format), `${stem}.${format}`);
    } catch (e) {
      const message = friendly(e, "Couldn't download that file. Please try again.");
      setError(message.charAt(0).toUpperCase() + message.slice(1));
    } finally {
      setBusy(null);
    }
  };

  const split = others.length > 0;
  const main = `inline-flex h-8 items-center gap-1.5 bg-night px-3 text-[12.5px] font-medium text-night-ink transition-colors hover:bg-night/85 disabled:cursor-not-allowed disabled:opacity-50 ${
    split ? "rounded-l-lg" : "rounded-lg"
  }`;
  const item =
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-ink transition-colors hover:bg-ink/[0.05]";

  return (
    <div className={`file-card my-3 w-full rounded-xl border border-edge bg-panel ${preview ? "" : "max-w-[560px]"}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tone}`} aria-hidden>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink" title={block.name}>
            {block.name}
          </p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-ink-dim">
            {props.writing ? (
              <>
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                <span className="truncate">Writing… {measure(block)}</span>
              </>
            ) : (
              <span className="truncate">
                {kindLabel(block)} · {measure(block)}
              </span>
            )}
            {props.incomplete && <Badge tone="warn">Incomplete</Badge>}
          </p>
        </div>
        {!props.writing && block.content.trim() && (
          <IconButton
            icon={preview ? EyeOff : Eye}
            label={preview ? "Hide preview" : "Preview"}
            active={preview}
            onClick={() => setPreview((v) => !v)}
          />
        )}
        <div ref={menuRef} className="relative flex shrink-0">
          <button
            type="button"
            className={main}
            disabled={!ready || busy !== null}
            onClick={() => void download(own)}
            title={ready ? `Download ${block.name}` : "Available when the reply finishes"}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Download</span>
          </button>
          {split && (
            <button
              type="button"
              className="inline-flex h-8 items-center rounded-r-lg border-l border-night-ink/20 bg-night px-1.5 text-night-ink transition-colors hover:bg-night/85 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!ready || busy !== null}
              onClick={() => setMenu((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menu}
              aria-label="Download as another format"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}
          {menu && (
            <div
              role="menu"
              className="pop-in absolute right-0 top-full z-30 mt-1.5 w-52 rounded-xl border border-edge bg-panel p-1.5 shadow-[0_16px_40px_-16px_rgb(0_0_0/0.35)]"
            >
              <p className="px-2 pb-1 pt-0.5 text-[11px] font-medium text-ink-faint">Download as</p>
              {[own, ...others].map((format) => (
                <button key={format} type="button" role="menuitem" className={item} onClick={() => void download(format)}>
                  {formatName(format)}
                  <span className="ml-auto text-[12px] text-ink-faint">.{format}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {error && <p className="border-t border-edge px-3 py-2 text-[12px] text-danger">{error}</p>}
      {preview && (
        <div className="max-h-[420px] overflow-auto border-t border-edge px-4 py-3">
          {family === "document" || family === "slides" ? (
            <Markdown text={block.content} />
          ) : (
            <pre className="whitespace-pre font-mono text-[12px] leading-relaxed text-ink">{block.content}</pre>
          )}
        </div>
      )}
    </div>
  );
}
