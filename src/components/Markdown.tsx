/** Lazy wrapper: the markdown renderer (react-markdown + remark-gfm, ~200 KB)
 *  is its own chunk, fetched the first time an assistant reply is shown.
 *  Until it arrives the text renders as plain pre-wrapped prose. */

import { Suspense, lazy } from "react";

const Renderer = lazy(() => import("./MarkdownRenderer"));

export default function Markdown(props: { text: string }) {
  return (
    <Suspense fallback={<div className="md whitespace-pre-wrap">{props.text}</div>}>
      <Renderer text={props.text} />
    </Suspense>
  );
}
