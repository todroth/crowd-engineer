/** Bestwerte (niedrigste Kosten) je Szenario, im Browser gespeichert. */
const STORAGE_PREFIX = "crowd-engineer.best.";

export function loadBestCost(scenarioName: string): number | undefined {
    try {
        const value = window.localStorage.getItem(STORAGE_PREFIX + scenarioName);

        return value === null ? undefined : Number(value);
    } catch {
        // Ohne Speicher (etwa privater Modus) gibt es eben keine Bestwerte.
        return undefined;
    }
}

/** Speichert `cost`, wenn es besser ist als der bisherige Bestwert. Gibt zurück, ob es ein neuer Bestwert ist. */
export function saveBestCost(scenarioName: string, cost: number): boolean {
    const best = loadBestCost(scenarioName);

    if (best !== undefined && best <= cost) {
        return false;
    }

    try {
        window.localStorage.setItem(STORAGE_PREFIX + scenarioName, String(cost));
    } catch {
        // siehe oben
    }

    return true;
}
