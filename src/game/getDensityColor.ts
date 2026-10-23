interface ColorStop {
    readonly density: number;
    readonly color: number;
}

const COLOR_STOPS: readonly ColorStop[] = [
    {density: 0, color: 0x35c759},  // Grün
    {density: 3, color: 0xffd60a},  // Gelb
    {density: 7, color: 0xff453a},  // Rot
    {density: 12, color: 0x7f0015}, // Dunkelrot
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
