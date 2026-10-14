const { registerUserPlugin, definePluginSettings, OptionType } = VencordShim;
const { React, useState, useEffect } = Vencord.Webpack.Common;
const { Button } = Vencord.Components;

const Native = VencordNative.pluginHelpers.GagspeakInterop;

const settings = definePluginSettings({
    tokenPath: {
        type: OptionType.STRING,
        description: "Path to the interop token.txt (empty = XIVLauncher default)",
        default: "",
        restartNeeded: true
    },
    port: {
        type: OptionType.NUMBER,
        description: "Interop socket port",
        default: 47731,
        restartNeeded: true
    },
    refresh: {
        type: OptionType.COMPONENT,
        component: () => {
            const [connected, setConnected] = useState(null);
            const refresh = async () => {
                setConnected(null);
                await Native.reconnect();
                await new Promise(r => setTimeout(r, 500));
                setConnected(await Native.isConnected());
            };
            useEffect(() => { Native.isConnected().then(setConnected); }, []);
            return React.createElement(Button, { onClick: refresh },
                `Refresh connection (${connected === null ? "checking..." : connected ? "connected" : "not connected"})`);
        }
    },
    testGagged: {
        type: OptionType.BOOLEAN,
        description: "Test: always garble outgoing messages, no socket needed",
        default: false
    }
});

const SOUNDS = ["m", "m", "m", "m", "m", "h", "h", "mh", "", ""];

function garbleWord(word) {
    const lead = word.match(/^\p{P}*/u)[0];
    const trail = word.slice(lead.length).match(/\p{P}*$/u)[0];
    const core = word.slice(lead.length, word.length - trail.length);
    if (!core || /^[mpgfh\p{P}]+$/iu.test(core)) return word;

    const allCaps = core === core.toUpperCase();
    const firstCaps = core[0] !== core[0].toLowerCase();
    let out = "";
    while (out.length < core.length) out += SOUNDS[Math.floor(Math.random() * SOUNDS.length)];
    out = out.slice(0, core.length);
    if (allCaps) out = out.toUpperCase();
    else if (firstCaps && out) out = out[0].toUpperCase() + out.slice(1);
    return lead + out + trail;
}

function garble(text) {
    let skip = false;
    return text.split(" ").map(word => {
        if (word === "*") { skip = !skip; return word; }
        if (word.startsWith("*")) skip = !skip;
        const toggleAfter = word.endsWith("*");
        // leave mentions, custom emoji, :emoji: and links alone
        const keep = skip || !/\p{L}/u.test(word) || /^<.*>$|^:\w+:$|^https?:\/\//.test(word);
        const res = keep ? word : garbleWord(word);
        if (toggleAfter) skip = !skip;
        return res;
    }).join(" ");
}

registerUserPlugin({
    name: "GagspeakInterop",
    description: "Garbles your outgoing messages while the GagSpeak interop plugin reports you as gagged",
    authors: [{ name: "Me", id: 0n }],
    settings,

    start: () => Native.start(settings.store.tokenPath, settings.store.port),
    stop: () => Native.stop(),

    async onBeforeMessageSend(_, msg) {
        if (settings.store.testGagged || await Native.isGagged()) msg.content = garble(msg.content);
    }
});
