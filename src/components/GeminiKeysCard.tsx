/**
 * Gemini API keys — `ProviderKeysCard` with the Gemini spec. The row and
 * payload types the other pages import keep their names here.
 */

import type { ComponentProps } from "react";
import ProviderKeysCard, {
  GEMINI_SPEC,
  keyName,
  type KeyHealth,
  type KeyRow,
  type KeysPayload,
  type RouteSummary,
} from "./ProviderKeysCard";

export type GeminiKeyRow = KeyRow;
export type GeminiKeysPayload = KeysPayload;
export type { KeyHealth, RouteSummary };
export { keyName };

export default function GeminiKeysCard(props: Omit<ComponentProps<typeof ProviderKeysCard>, "spec">) {
  return <ProviderKeysCard spec={GEMINI_SPEC} {...props} />;
}
