interface ColorStop {
    readonly density: number;
    readonly color: number;
}

/**
 * Je dunkler, desto schlechter. Die Werte sind Kernel-Dichten (`Agent.localDensity`,
 * inklusive Wandverstärkung; mit den Standardwerten ≈ 0,39 Personen/m² je Einheit).
 * Die Skala deckt die gesamte Spanne ab, die in der Simulation vorkommt (bis etwa
 * 20, an Wänden eingeklemmt):
 *
 *   hellgrün → gelb → orange:   frei bis eng
 *   rot → dunkelrot → fast schwarz:   Gedränge bis Quetschgefahr
 */
const COLOR_STOPS: readonly ColorStop[] = [
    {density: 0, color: 0x6be585},  // Hellgrün: frei
    {density: 3, color: 0xffe14d},  // Gelb: dicht
    {density: 6, color: 0xff9f1a},  // Orange: eng
    {density: 9, color: 0xf04438},  // Rot: sehr eng
    {density: 12, color: 0xb0122e}, // Dunkelrot: Gedränge
    {density: 16, color: 0x6a0a2b}, // Weinrot: gefährlich
    {density: 20, color: 0x2a0518}, // Fast schwarz: Quetschgefahr
];

function interpolateColor(
    from: number,
    to: number,
    amount: number,
): number {
    const fromR = (from >> 16) & 0xff;
    const fromG = (from >> 8) & 0xff;
    const fromB = from & 0xff;

    const toR = (to >> 16) & 0xff;
    const toG = (to >> 8) & 0xff;
    const toB = to & 0xff;

    const r = Math.round(fromR + (toR - fromR) * amount);
    const g = Math.round(fromG + (toG - fromG) * amount);
    const b = Math.round(fromB + (toB - fromB) * amount);

    return (r << 16) | (g << 8) | b;
}

/** Farbe eines Agenten mit dieser Kernel-Dichte. */
export function getDensityColor(density: number): number {
    if (density <= COLOR_STOPS[0].density) {
        return COLOR_STOPS[0].color;
    }

    for (let i = 1; i < COLOR_STOPS.length; i++) {
        const previous = COLOR_STOPS[i - 1];
        const current = COLOR_STOPS[i];

        if (density <= current.density) {
            const amount =
                (density - previous.density) /
                (current.density - previous.density);

            return interpolateColor(
                previous.color,
                current.color,
                amount,
            );
        }
    }

    return COLOR_STOPS[COLOR_STOPS.length - 1].color;
}
