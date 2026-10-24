/**
 * The admins' Uncensored model switch (ohshi/uncensored/ on the backend): a
 * Kaggle GPU run that serves the model for twenty minutes at a time.
 *
 * The sidebar owns the switch and announces every change of state on window
 * (UNCENSORED_EVENT), so the chat page can reload its model list — and pick
 * the model the moment the admin's own switch brings it on.
 */

import { get, post } from "./api";

export type UncensoredStatus = "off" | "starting" | "on";

export interface UncensoredState {
  /** False when the server has no Kaggle account to run it on. */
  configured: boolean;
  status: UncensoredStatus;
  /** How long a session lasts, from the moment it is switched on. */
  minutes: number;
  model: string;
  /** The server's clock, to count down without trusting ours. */
  serverMs: number;
  phase?: string;
  startedMs?: number;
  endsMs?: number;
  remainingMs?: number;
  message?: string;
  endedReason?: "stopped" | "time" | "failed" | "lost";
}

export const UNCENSORED_MODEL_ID = "uncensored";
export const UNCENSORED_EVENT = "ohshi:uncensored";

export interface UncensoredEventDetail {
  status: UncensoredStatus;
  /** The admin just switched it on here: select the model now that it is on. */
  select: boolean;
}

export const getUncensored = () => get<UncensoredState>("/api/uncensored/status");
export const startUncensored = () => post<UncensoredState>("/api/uncensored/start");
export const stopUncensored = () => post<UncensoredState>("/api/uncensored/stop");

export function announceUncensored(detail: UncensoredEventDetail): void {
  window.dispatchEvent(new CustomEvent<UncensoredEventDetail>(UNCENSORED_EVENT, { detail }));
}

/** "17:42" for the time a session has left. */
export function timeLeft(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
