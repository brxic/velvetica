export type PanelRect = { left: number; right: number; top: number; bottom: number; width: number; height: number }
export type MapInsets = { top: number; right: number; bottom: number; left: number }

/** The map and its controls use the same measured, unobstructed work area. */
export function mapInsets(width: number, height: number, header: PanelRect | null, panels: PanelRect[]): MapInsets {
  const padding = { top: header ? header.bottom + 12 : 24, right: 20, bottom: 20, left: 20 }
  for (const panel of panels) {
    if (panel.width <= 0 || panel.height <= 0) continue
    if (panel.width > width * .65 || panel.height < height * .6) padding.bottom = Math.max(padding.bottom, height - panel.top + 16)
    else if (panel.left < width * .25) padding.left = Math.max(padding.left, panel.right + 16)
    else padding.right = Math.max(padding.right, width - panel.left + 16)
  }
  // Keep a usable camera viewport even in short landscape windows.
  padding.bottom = Math.min(padding.bottom, Math.max(20, height - padding.top - 140))
  padding.right = Math.min(padding.right, Math.max(20, width - padding.left - 140))
  padding.left = Math.min(padding.left, Math.max(20, width - padding.right - 140))
  return padding
}
