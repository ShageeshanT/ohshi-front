/** The glossy hexagon tiles behind the signed-in app and the auth pages, with
 *  a faint brand mark watermark in the middle. Fixed, behind everything. */

import tilesDark from "../../assets/tiles-dark.webp";
import tilesLight from "../../assets/tiles-light.webp";
import { useTheme } from "../../lib/theme";
import { useBrandArt } from "../brand";

export function TilesBackdrop(props: { watermark?: boolean }) {
  const { theme } = useTheme();
  const { mark } = useBrandArt();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <img
        src={theme === "dark" ? tilesDark : tilesLight}
        alt=""
        draggable={false}
        className="h-full w-full object-cover"
      />
      <div className="tiles-veil absolute inset-0" />
      {props.watermark !== false && (
        <img
          src={mark}
          alt=""
          draggable={false}
          className="absolute left-1/2 top-1/2 h-[46vh] w-auto -translate-x-1/2 -translate-y-1/2 opacity-[0.07] select-none"
        />
      )}
    </div>
  );
}
