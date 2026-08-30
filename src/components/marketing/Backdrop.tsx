/** The glossy hexagon tiles behind the signed-in app and the auth pages.
 *  Fixed, behind everything. */

import tilesDark from "../../assets/tiles-dark.webp";
import tilesLight from "../../assets/tiles-light.webp";
import { useTheme } from "../../lib/theme";

export function TilesBackdrop() {
  const { theme } = useTheme();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <img
        src={theme === "dark" ? tilesDark : tilesLight}
        alt=""
        draggable={false}
        className="h-full w-full object-cover"
      />
      <div className="tiles-veil absolute inset-0" />
    </div>
  );
}
