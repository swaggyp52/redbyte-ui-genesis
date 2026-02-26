export type TileRegion = "left" | "right" | "top" | "bottom" | "fullscreen" | "quad1" | "quad2" | "quad3" | "quad4";

export function getTileLayout(region: TileRegion, screenW: number, screenH: number) {
  switch (region) {
    case "left":
      return { x: 12, y: 48, width: screenW / 2 - 24, height: screenH - 96 };
    case "right":
      return { x: screenW / 2 + 12, y: 48, width: screenW / 2 - 24, height: screenH - 96 };
    case "top":
      return { x: 12, y: 48, width: screenW - 24, height: screenH / 2 - 48 };
    case "bottom":
      return { x: 12, y: screenH / 2, width: screenW - 24, height: screenH / 2 - 72 };
    case "fullscreen":
      return { x: 12, y: 48, width: screenW - 24, height: screenH - 96 };
    case "quad1":
      return { x: 12, y: 48, width: screenW / 2 - 24, height: screenH / 2 - 48 };
    case "quad2":
      return { x: screenW / 2 + 12, y: 48, width: screenW / 2 - 24, height: screenH / 2 - 48 };
    case "quad3":
      return { x: 12, y: screenH / 2, width: screenW / 2 - 24, height: screenH / 2 - 72 };
    case "quad4":
      return { x: screenW / 2 + 12, y: screenH / 2, width: screenW / 2 - 24, height: screenH / 2 - 72 };
    default:
      return null;
  }
}

