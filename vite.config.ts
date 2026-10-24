import {defineConfig} from "vite";

export default defineConfig({
    // Relative Pfade: Der Build läuft so unter jeder Adresse, auch unter
    // https://<user>.github.io/crowd-engineer/ (GitHub Pages).
    base: "./",
    // Phaser allein ist gut 1 MB groß; die Standardwarnung ab 500 kB ist hier nur Rauschen.
    build: {chunkSizeWarningLimit: 2000},
});
