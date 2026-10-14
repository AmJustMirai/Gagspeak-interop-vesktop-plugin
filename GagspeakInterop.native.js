const { readFileSync } = require("fs");
const { homedir } = require("os");
const { join } = require("path");

// Runs in the main process: the interop server rejects connections that carry an Origin header,
// which the renderer's WebSocket always sends.
let gagged = false;
let ws = null;
let timer;

function defaultTokenPath() {
    const rel = join("pluginConfigs", "GagspeakInterop", "token.txt");
    return process.platform === "win32"
        ? join(process.env.APPDATA ?? "", "XIVLauncher", rel)
        : join(homedir(), ".xlcore", rel);
}

function connect(tokenPath, port) {
    try {
        const token = readFileSync(tokenPath || defaultTokenPath(), "utf8").trim();
        const socket = new WebSocket(`ws://127.0.0.1:${port}/?token=${token}`);
        socket.onmessage = e => { gagged = JSON.parse(String(e.data)).event === "gagged"; };
        socket.onclose = socket.onerror = () => { gagged = false; };
        ws = socket;
    } catch {
        gagged = false;
    }
}

let args = ["", 0];

function stop() {
    clearInterval(timer);
    ws?.close();
    ws = null;
    gagged = false;
}

function start(_, tokenPath, port) {
    stop();
    args = [tokenPath, port];
    connect(...args);
    // token is regenerated on every Dalamud load, so reconnect re-reads it
    timer = setInterval(() => {
        if (!ws || ws.readyState === WebSocket.CLOSED) connect(...args);
    }, 5000);
}

function isConnected() {
    return ws?.readyState === WebSocket.OPEN;
}

function reconnect() {
    ws?.close();
    connect(...args);
}

function isGagged() {
    return gagged;
}

module.exports = { start, isConnected, reconnect, stop, isGagged };
