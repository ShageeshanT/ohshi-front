/**
 * The admins' image model switch, in the sidebar's Operator section:
 * RealVisXL V5.0 on a Kaggle GPU for an hour at a time. Fast is up as soon as
 * it is on; Quality joins a minute or two later.
 */

import { Images } from "lucide-react";
import { announceImages, getImages, startImages, stopImages } from "../lib/images";
import { KaggleSwitch, type KaggleSwitchSpec } from "./KaggleSwitch";

const SPEC: KaggleSwitchSpec = {
  label: "Images",
  icon: Images,
  title: "Admins only: RealVisXL image generation on a Kaggle GPU",
  starting: "Starting on Kaggle · 3–5 min",
  onDetail: (state) => (state.variants?.includes("quality") ? "" : "Quality loading"),
  load: getImages,
  start: startImages,
  stop: stopImages,
  announce: announceImages,
};

export default function ImagesSwitch(props: { collapsed: boolean }) {
  return <KaggleSwitch collapsed={props.collapsed} spec={SPEC} />;
}
