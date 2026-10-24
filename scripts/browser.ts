// Spielt das Spiel im Browser durch, in Echtzeit, und macht Screenshots. Braucht den
// laufenden Dev-Server (npx vite --port 5199) und Google Chrome:
//   node scripts/browser.ts "http://localhost:5199/?scenario=2" shot:plan click:250:560 enter s wait:30000 shot:end
// Schritte: shot:NAME (→ /tmp/crowd-NAME.png), wait:MS, click:X:Y, rclick:X:Y, move:X:Y
// (Bildschirmpixel; die Welt beginnt 34 px unter dem oberen Rand), enter, space, s, p, c, f, 1–9.
//
// Steuert Chrome über das DevTools-Protokoll. Der Screenshot-Modus von Chrome
// (--screenshot) taugt hier nicht: Mit virtueller Zeit rechnet Phaser nur die ersten Bilder.
import {spawn} from "node:child_process";
import {writeFileSync} from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const [url, ...steps] = process.argv.slice(2);

const KEYS: Record<string, [key: string, code: string, keyCode: number]> = {
    enter: ["Enter", "Enter", 13],
    space: [" ", "Space", 32],
    s: ["s", "KeyS", 83],
    p: ["p", "KeyP", 80],
    c: ["c", "KeyC", 67],
    f: ["f", "KeyF", 70],
};

for (let digit = 1; digit <= 9; digit++) {
    KEYS[String(digit)] = [String(digit), `Digit${digit}`, 48 + digit];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const chrome = spawn(CHROME, [
    "--headless=new",
    `--user-data-dir=/tmp/crowd-chrome-${process.pid}`,
    `--remote-debugging-port=${PORT}`,
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--window-size=1000,844",
    "about:blank",
], {stdio: "ignore"});

try {
    const page = await findPage();
    const socket = new WebSocket(page);
    let nextId = 0;
    const pending = new Map<number, (result: any) => void>();

    await new Promise((resolve) => socket.addEventListener("open", resolve));
    socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data));

        pending.get(message.id)?.(message.result ?? message.error);
        pending.delete(message.id);
    });

    const send = (method: string, params: object = {}): Promise<any> =>
        new Promise((resolve) => {
            const id = ++nextId;

            pending.set(id, resolve);
            socket.send(JSON.stringify({id, method, params}));
        });

    const mouse = async (x: number, y: number, button: string) => {
        for (const type of ["mousePressed", "mouseReleased"]) {
            await send("Input.dispatchMouseEvent", {type, x, y, button, clickCount: 1});
        }
    };

    await send("Page.enable");
    await send("Page.navigate", {url});
    await sleep(3000);

    for (const step of steps) {
        const [command, a, b] = step.split(":");

        if (command === "shot") {
            const {data} = await send("Page.captureScreenshot", {format: "png"});
            const file = `/tmp/crowd-${a}.png`;

            writeFileSync(file, Buffer.from(data, "base64"));
            console.log(file);
        } else if (command === "wait") {
            await sleep(Number(a));
        } else if (command === "click" || command === "rclick") {
            await mouse(Number(a), Number(b), command === "click" ? "left" : "right");
        } else if (command === "move") {
            await send("Input.dispatchMouseEvent", {type: "mouseMoved", x: Number(a), y: Number(b)});
        } else if (KEYS[command]) {
            const [key, code, windowsVirtualKeyCode] = KEYS[command];

            for (const type of ["keyDown", "keyUp"]) {
                await send("Input.dispatchKeyEvent", {type, key, code, windowsVirtualKeyCode});
            }
            // Phaser liest Tasten einmal pro Bild; zwei Anschläge im selben Bild gingen sonst verloren.
            await sleep(100);
        } else {
            throw new Error(`Unbekannter Schritt: ${step}`);
        }
    }

    socket.close();
} finally {
    chrome.kill();
}

async function findPage(): Promise<string> {
    for (let attempt = 0; attempt < 50; attempt++) {
        try {
            const response = await fetch(`http://127.0.0.1:${PORT}/json`);
            const targets = (await response.json()) as {type: string; webSocketDebuggerUrl: string}[];
            const page = targets.find((target) => target.type === "page");

            if (page) {
                return page.webSocketDebuggerUrl;
            }
        } catch {
            // Chrome startet noch.
        }

        await sleep(200);
    }

    throw new Error("Chrome antwortet nicht");
}
