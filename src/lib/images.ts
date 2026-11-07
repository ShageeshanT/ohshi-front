/**
 * The admins' image model switch (ohshi/images/ on the backend): RealVisXL V5.0
 * on a Kaggle GPU for an hour at a time — the Uncensored switch's twin, with
 * its own event so the chat page picks the image model when it comes on.
 */

import { get, post } from "./api";
import type { UncensoredEventDetail, UncensoredState } from "./uncensored";

export const IMAGES_MODEL_ID = "realvisxl-fast";
export const IMAGES_EVENT = "ohshi:images";

export const getImages = () => get<UncensoredState>("/api/images/status");
export const startImages = () => post<UncensoredState>("/api/images/start");
export const stopImages = () => post<UncensoredState>("/api/images/stop");

export function announceImages(detail: UncensoredEventDetail): void {
  window.dispatchEvent(new CustomEvent<UncensoredEventDetail>(IMAGES_EVENT, { detail }));
}

/** Whether *id* is one of the image model's ids (its replies are pictures). */
export function isImageModel(id: string | null | undefined): boolean {
  return Boolean(id && id.startsWith("realvisxl"));
}
