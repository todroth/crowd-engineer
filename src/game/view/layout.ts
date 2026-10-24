/**
 * Aufteilung des Bildes: Statusleiste oben, darunter die Welt (alle Level sind
 * 1000×700 Pixel groß), unten die Infoleiste. Die Leisten liegen neben der Welt,
 * damit sie nichts verdecken.
 */
export const VIEW_WIDTH = 1000;
export const WORLD_HEIGHT = 700;
export const TOP_BAR_HEIGHT = 34;
export const BOTTOM_BAR_HEIGHT = 110;
export const VIEW_HEIGHT = TOP_BAR_HEIGHT + WORLD_HEIGHT + BOTTOM_BAR_HEIGHT;
