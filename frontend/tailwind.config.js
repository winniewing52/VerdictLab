module.exports = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                ink: "#0A0A0B",
                panel: "#111113",
                line: "#232326",
                signal: "#F2CB2E",
                alert: "#E24C3E",
                muted: "#9A9AA0",
            },
            fontFamily: {
                mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
                sans: ["Inter", "ui-sans-serif", "system-ui"],
                display: ["Anton", "Impact", "'Arial Narrow'", "sans-serif"],
            },
        },
    },
    plugins: [],
};
