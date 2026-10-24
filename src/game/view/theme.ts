/** Farben und Schrift an einer Stelle, damit das Bild zusammenpasst. */
export const THEME = {
    background: 0x0d141c,
    floor: 0x141e29,
    grid: 0x1c2836,
    wall: 0x55657c,
    wallEdge: 0x8fa1bb,
    shadow: 0x000000,
    shadowAlpha: 0.35,
    exit: 0x34d399,
    /** Ausgang, den die Menge nicht kennt (nur über einen Weg oder Schilder zu finden). */
    hiddenExit: 0x22d3ee,
    panel: 0x0b1118,
    panelAlpha: 0.82,
    text: "#e6edf5",
    mutedText: "#9aacc7",
    accentText: "#fde68a",
    font: "monospace",
} as const;

/** Farbe je Weg (A, B, C, …): Wegmarkierung und Schilder, die darauf zeigen. */
export const ROUTE_COLORS = [0x60a5fa, 0xf472b6, 0xa78bfa, 0xfbbf24, 0x4ade80] as const;

export function routeColor(route: number): number {
    return ROUTE_COLORS[route % ROUTE_COLORS.length];
}

export function routeLetter(route: number): string {
    return String.fromCharCode(65 + route);
}

/** Phaser-Farbe (0xrrggbb) als CSS-Farbe. */
export function cssColor(color: number): string {
    return `#${color.toString(16).padStart(6, "0")}`;
}
