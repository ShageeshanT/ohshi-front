/**
 * The admins' Uncensored model switch, in the sidebar's Operator section: a
 * Kaggle GPU run that serves the model for twenty minutes at a time.
 */

import { VenetianMask } from "lucide-react";
import { announceUncensored, getUncensored, startUncensored, stopUncensored } from "../lib/uncensored";
import { KaggleSwitch, type KaggleSwitchSpec } from "./KaggleSwitch";

const SPEC: KaggleSwitchSpec = {
  label: "Uncensored",
  icon: VenetianMask,
  title: "Admins only: the Uncensored model on a Kaggle GPU",
  starting: "Starting on Kaggle · 2–3 min",
  load: getUncensored,
  start: startUncensored,
  stop: stopUncensored,
  announce: announceUncensored,
};

export default function UncensoredSwitch(props: { collapsed: boolean }) {
  return <KaggleSwitch collapsed={props.collapsed} spec={SPEC} />;
}
