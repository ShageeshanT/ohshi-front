/** Files in a chat reply.
 *
 *  A model asked for a file writes it in a fenced `file` block (the persona in
 *  ohshi/chat/prompt.py teaches the shape); the chat shows each block as a card
 *  and downloads the real file from
 *  GET /api/chats/:chatId/messages/:messageId/files/:index.
 *
 *  `splitFiles` is a line-for-line port of backend ohshi/files/blocks.py, and
 *  `familyOf` / `targetsOf` of ohshi/files/formats.py: the n-th block here is
 *  the n-th block there, which is what the URL addresses. Change them together. */

export interface FileBlock {
  index: number;
  name: string;
  ext: string;
  content: string;
  closed: boolean;
  attrs: Record<string, string>;
}

export type Segment = { kind: "text"; text: string } | { kind: "file"; block: FileBlock };

export type Family = "document" | "slides" | "sheet" | "text";

const MAX_BLOCKS = 20;
const NAME_MAX = 120;
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FILE_INFO = /^file(?=$|[\s:])/i;
const ATTR = /([A-Za-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
const UNSAFE = /[\x00-\x1f\x7f<>:"|?*]/g;
const QUOTES = /^["']+|["']+$/g;

/** Python's str.strip(chars) (or rstrip when `start` is false). */
function trimChars(text: string, chars: string, start = true): string {
  let a = 0;
  let b = text.length;
  while (start && a < b && chars.includes(text[a])) a += 1;
  while (b > a && chars.includes(text[b - 1])) b -= 1;
  return text.slice(a, b);
}

/** A safe download name — the same rules as the backend's clean_name. */
export function cleanName(raw: string): string {
  let name = raw.trim().replace(QUOTES, "").replace(/\\/g, "/");
  name = name.split("/").pop() ?? "";
  name = trimChars(name.replace(UNSAFE, ""), " .");
  if (!name) return "document.md";
  const dot = name.lastIndexOf(".");
  let stem = dot >= 0 ? name.slice(0, dot) : "";
  let ext = dot >= 0 ? name.slice(dot + 1) : "";
  if (dot < 0 || !stem || !/^[A-Za-z0-9]{1,8}$/.test(ext)) {
    stem = name;
    ext = "md";
  }
  stem = trimChars(stem.slice(0, NAME_MAX - ext.length - 1), " .", false) || "document";
  return `${stem}.${ext}`;
}

function attrsOf(info: string): Record<string, string> {
  const rest = info.slice(4).replace(/^[: \t]+/, "");
  const found: Record<string, string> = {};
  for (const m of rest.matchAll(ATTR)) found[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  if (!("name" in found)) {
    const first = rest.split(/\s+/).filter(Boolean)[0] ?? "";
    if (!first.includes("=") && first.includes(".")) found.name = first.replace(QUOTES, "");
  }
  return found;
}

/** The length of a bare fence of `char` (no info string), else 0. */
function bare(line: string, char: string): number {
  const m = FENCE.exec(line);
  if (!m || m[1][0] !== char || m[2].trim()) return 0;
  return m[1].length;
}

function closePlain(lines: string[], start: number, fence: string): number | null {
  for (let j = start; j < lines.length; j += 1) {
    if (bare(lines[j], fence[0]) >= fence.length) return j;
  }
  return null;
}

function closeFile(lines: string[], start: number, fence: string, final: boolean): number | null {
  const char = fence[0];
  const size = fence.length;
  if (size >= 4) {
    let last: number | null = null;
    for (let j = start; j < lines.length; j += 1) {
      const length = bare(lines[j], char);
      if (length >= size) return j;
      if (length) last = j;
    }
    // Opened with four, closed with three: only once the reply is complete.
    return final ? last : null;
  }
  let depth = 0;
  for (let j = start; j < lines.length; j += 1) {
    const m = FENCE.exec(lines[j]);
    if (!m || m[1][0] !== char) continue;
    if (m[2].trim()) depth += 1;
    else if (depth) depth -= 1;
    else return j;
  }
  return null;
}

/** A reply as text and file segments, in order. `final` is false while the
 *  reply is still streaming (a short fence may yet be an inner one). */
export function splitFiles(text: string, final = true): Segment[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: Segment[] = [];
  let count = 0;
  let textStart = 0;
  let textEnd = lines.length;
  let i = 0;
  const pushText = (end: number) => {
    const chunk = lines.slice(textStart, end).join("\n");
    if (chunk.trim()) out.push({ kind: "text", text: chunk });
  };
  while (i < lines.length && count < MAX_BLOCKS) {
    const m = FENCE.exec(lines[i]);
    if (!m) {
      i += 1;
      continue;
    }
    const fence = m[1];
    const info = m[2].trim();
    if (fence[0] === "`" && info.includes("`")) {
      i += 1;
      continue;
    }
    // Mid-stream, a fence line still being written may be a file's opening
    // line with half its name: wait for the rest of it.
    if (!final && i === lines.length - 1) {
      textEnd = i;
      break;
    }
    if (FILE_INFO.test(info)) {
      const close = closeFile(lines, i + 1, fence, final);
      const end = close ?? lines.length;
      const attrs = attrsOf(info);
      const name = cleanName(attrs.name ?? "");
      pushText(i);
      out.push({
        kind: "file",
        block: {
          index: count,
          name,
          ext: name.slice(name.lastIndexOf(".") + 1).toLowerCase(),
          content: lines.slice(i + 1, end).join("\n"),
          closed: close !== null,
          attrs,
        },
      });
      count += 1;
      i = end + 1;
      textStart = i;
      continue;
    }
    const close = closePlain(lines, i + 1, fence);
    i = (close ?? lines.length) + 1;
  }
  textStart = Math.min(textStart, lines.length);
  pushText(textEnd);
  return out;
}

// --- formats (ohshi/files/formats.py) -----------------------------------------------------
const ALIASES: Record<string, string> = { markdown: "md", htm: "html", doc: "docx", ppt: "pptx", xls: "xlsx" };
const PAGE = /^\s*(<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>])/i;
const TARGETS: Partial<Record<Family, string[]>> = {
  document: ["pdf", "docx", "md", "html"],
  slides: ["pptx", "pdf", "md"],
  sheet: ["xlsx", "csv"],
};

export function canonicalExt(ext: string): string {
  const lower = ext.toLowerCase();
  return ALIASES[lower] ?? lower;
}

export function familyOf(block: FileBlock): Family {
  const ext = canonicalExt(block.ext);
  if (ext === "pdf" || ext === "docx" || ext === "md") return "document";
  if (ext === "html") return PAGE.test(block.content) ? "text" : "document";
  if (ext === "pptx") return "slides";
  if (ext === "xlsx" || ext === "csv" || ext === "tsv") return "sheet";
  return "text";
}

/** Formats the block can be downloaded as, its own first. */
export function targetsOf(block: FileBlock): string[] {
  const own = canonicalExt(block.ext);
  return [own, ...(TARGETS[familyOf(block)] ?? []).filter((t) => t !== own)];
}

const FORMAT_NAMES: Record<string, string> = {
  pdf: "PDF",
  docx: "Word",
  pptx: "PowerPoint",
  xlsx: "Excel",
  csv: "CSV",
  tsv: "TSV",
  md: "Markdown",
  html: "Web page",
  txt: "Text",
};

const CODE_NAMES: Record<string, string> = {
  py: "Python", js: "JavaScript", mjs: "JavaScript", ts: "TypeScript", tsx: "TypeScript", jsx: "JavaScript",
  json: "JSON", xml: "XML", yaml: "YAML", yml: "YAML", toml: "TOML", sql: "SQL", sh: "Shell script",
  ps1: "PowerShell", bat: "Batch file", css: "CSS", html: "HTML", java: "Java", c: "C", cpp: "C++", h: "C header",
  cs: "C#", go: "Go", rs: "Rust", rb: "Ruby", php: "PHP", swift: "Swift", kt: "Kotlin", svg: "SVG image",
  ics: "Calendar", vcf: "Contact card", txt: "Text", log: "Log",
};

/** "PDF", "Word", "Excel" — a format's name on a button. */
export function formatName(ext: string): string {
  return FORMAT_NAMES[ext] ?? ext.toUpperCase();
}

/** "PDF document", "PowerPoint deck", "Python" — what the card says the file is. */
export function kindLabel(block: FileBlock): string {
  const ext = canonicalExt(block.ext);
  switch (familyOf(block)) {
    case "document":
      if (ext === "pdf") return "PDF document";
      if (ext === "docx") return "Word document";
      return ext === "html" ? "Web page" : "Markdown";
    case "slides":
      return "PowerPoint deck";
    case "sheet":
      return ext === "xlsx" ? "Excel workbook" : ext.toUpperCase();
    default:
      return CODE_NAMES[ext] ?? `${ext.toUpperCase()} file`;
  }
}

/** A short measure of the content: words, slides, rows or lines. */
export function measure(block: FileBlock): string {
  const text = block.content;
  const plural = (n: number, one: string) => `${n.toLocaleString()} ${one}${n === 1 ? "" : "s"}`;
  switch (familyOf(block)) {
    case "document":
      return plural(text.split(/\s+/).filter((w) => /\w/.test(w)).length, "word");
    case "slides": {
      const lines = text.split("\n");
      const breaks = lines.filter((l) => /^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(l)).length;
      const heads = lines.filter((l) => /^#{1,2} \S/.test(l)).length;
      return plural(breaks ? breaks + 1 : Math.max(1, heads), "slide");
    }
    case "sheet": {
      const lines = text.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
      const rules = lines.filter((l) => /^\s*\|?\s*:?-{3,}/.test(l)).length;
      // Each Markdown table has one header row (and one rule); a CSV has one header line.
      return plural(Math.max(0, lines.length - 2 * rules - (rules ? 0 : 1)), "row");
    }
    default:
      return plural(text ? text.split("\n").length : 0, "line");
  }
}

export function fileUrl(chatId: string, messageId: number, block: FileBlock, format?: string): string {
  const params = new URLSearchParams({ name: block.name });
  if (format) params.set("format", format);
  return `/api/chats/${encodeURIComponent(chatId)}/messages/${messageId}/files/${block.index}?${params}`;
}
