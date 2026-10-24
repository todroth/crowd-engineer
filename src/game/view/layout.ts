/**
 * Aufteilung des Bildes: links die Welt (alle Level sind 1000×700 Pixel groß) mit
 * Statusleiste darüber und Infoleiste darunter, rechts die Seitenleiste. Die
 * Leisten liegen neben der Welt, damit sie nichts verdecken.
 */
export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 700;
export const TOP_BAR_HEIGHT = 34;
export const BOTTOM_BAR_HEIGHT = 110;
export const PANEL_WIDTH = 230;
export const VIEW_WIDTH = WORLD_WIDTH + PANEL_WIDTH;
export const VIEW_HEIGHT = TOP_BAR_HEIGHT + WORLD_HEIGHT + BOTTOM_BAR_HEIGHT;
