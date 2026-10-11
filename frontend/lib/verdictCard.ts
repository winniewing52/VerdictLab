import { TONE_COLORS, downsample, signed, type Verdict } from "@/lib/verdict";
const W = 1200;
const H = 630;
const SCALE = 2;
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const C = {
    bg: "#0b0f14",
    text: "#e7e9eb",
    soft: "#cfd4d8",
    muted: "#7d858d",
    dim: "#586169",
    panel: "#10161c",
    line: "#232b33",
    amber: "#f0ae2a",
    red: "#ef4e50",
    blue: "#08afd4",
    green: "#43ba88",
};
const font = (weight: number | string, size: number, family: string) => `${weight} ${size}px ${family}`;
function hexA(hex: string, alpha: number) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
function spacing(ctx: CanvasRenderingContext2D, px: number) {
    (ctx as unknown as {
        letterSpacing?: string;
    }).letterSpacing = `${px}px`;
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, weight: number, size: number, family: string, min = 12) {
    let s = size;
    ctx.font = font(weight, s, family);
    while (ctx.measureText(text).width > maxWidth && s > min) {
        s -= 1;
        ctx.font = font(weight, s, family);
    }
    return s;
}
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    if (ctx.measureText(text).width <= maxWidth)
        return text;
    let out = text;
    while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth)
        out = out.slice(0, -1);
    return `${out.trimEnd()}…`;
}
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(test).width > maxWidth) {
            lines.push(line);
            line = word;
        }
        else {
            line = test;
        }
    }
    if (line)
        lines.push(line);
    if (lines.length <= maxLines)
        return lines;
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = ellipsize(ctx, `${kept[maxLines - 1]} ${lines[maxLines]}`, maxWidth);
    return kept;
}
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = C.muted, size = 11) {
    ctx.font = font(500, size, MONO);
    spacing(ctx, 1.8);
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.fillText(text, x, y);
    spacing(ctx, 0);
}
function tile(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, value: string, detail: string, valueColor: string) {
    const w = 172;
    const h = 92;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = C.panel;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    label(ctx, name, x + 14, y + 24, C.muted, 10);
    fitFont(ctx, value, w - 28, 700, 26, SANS, 14);
    ctx.fillStyle = valueColor;
    ctx.textAlign = "left";
    ctx.fillText(value, x + 14, y + 56);
    ctx.font = font(400, 11, MONO);
    ctx.fillStyle = C.dim;
    ctx.fillText(ellipsize(ctx, detail, w - 28), x + 14, y + 78);
}
function sparkline(ctx: CanvasRenderingContext2D, values: number[], x: number, y: number, w: number, h: number, color: string) {
    if (values.length < 2) {
        ctx.font = font(400, 12, MONO);
        ctx.fillStyle = C.dim;
        ctx.textAlign = "left";
        ctx.fillText("Not enough dated records to chart a trend", x, y + h / 2 + 4);
        return;
    }
    const lo = Math.min(0, ...values);
    const hi = Math.max(0, ...values);
    const span = hi - lo || 1;
    const px = (i: number) => x + (i / (values.length - 1)) * w;
    const py = (v: number) => y + (1 - (v - lo) / span) * h;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#2a323a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, py(0));
    ctx.lineTo(x + w, py(0));
    ctx.stroke();
    ctx.restore();
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, hexA(color, 0.32));
    grad.addColorStop(1, hexA(color, 0));
    ctx.beginPath();
    ctx.moveTo(px(0), py(0));
    values.forEach((v, i) => ctx.lineTo(px(i), py(v)));
    ctx.lineTo(px(values.length - 1), py(0));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    values.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.stroke();
}
function draw(ctx: CanvasRenderingContext2D, v: Verdict) {
    const tone = TONE_COLORS[v.tone];
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(1020, 40, 0, 1020, 40, 580);
    glow.addColorStop(0, hexA(tone, 0.26));
    glow.addColorStop(1, hexA(tone, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= W; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx + 0.5, 0);
        ctx.lineTo(gx + 0.5, H);
        ctx.stroke();
    }
    for (let gy = 0; gy <= H; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy + 0.5);
        ctx.lineTo(W, gy + 0.5);
        ctx.stroke();
    }
    ctx.fillStyle = tone;
    ctx.fillRect(0, 0, W, 6);
    roundRect(ctx, 60, 38, 30, 30, 7);
    ctx.fillStyle = C.amber;
    ctx.fill();
    ctx.font = font(700, 15, MONO);
    ctx.fillStyle = "#111820";
    ctx.textAlign = "center";
    ctx.fillText("V", 75, 59);
    ctx.textAlign = "left";
    ctx.font = font(700, 15, MONO);
    spacing(ctx, 3);
    ctx.fillStyle = C.text;
    ctx.fillText("VERDICTLAB", 102, 59);
    spacing(ctx, 1.5);
    ctx.font = font(400, 12, MONO);
    ctx.fillStyle = C.muted;
    ctx.textAlign = "right";
    ctx.fillText(`SENTIMENT VERDICT  ·  ${v.generatedOn.toUpperCase()}`, 1140, 58);
    spacing(ctx, 0);
    ctx.textAlign = "left";
    ctx.font = font(700, 34, SERIF);
    ctx.fillStyle = C.text;
    const titleLines = wrapLines(ctx, v.title, 1040, 2);
    titleLines.forEach((line, i) => ctx.fillText(line, 60, 128 + i * 42));
    const sourceY = 128 + (titleLines.length - 1) * 42 + 34;
    ctx.font = font(400, 13, MONO);
    ctx.fillStyle = C.muted;
    ctx.fillText(ellipsize(ctx, `${v.source}${v.dateRange ? `  ·  ${v.dateRange}` : ""}`.toUpperCase(), 1040), 60, sourceY);
    label(ctx, "THE VERDICT", 60, 262, C.amber, 12);
    fitFont(ctx, v.word, 690, 700, 128, SERIF, 60);
    ctx.fillStyle = tone;
    ctx.fillText(v.word, 56, 372);
    ctx.font = font(500, 21, SANS);
    ctx.fillStyle = C.soft;
    wrapLines(ctx, v.headline, 660, 2).forEach((line, i) => ctx.fillText(line, 60, 414 + i * 29));
    const polarityColor = v.polarity < -0.05 ? C.red : v.polarity > 0.05 ? C.green : C.text;
    tile(ctx, 780, 250, "MEAN POLARITY", signed(v.polarity), `VADER ${signed(v.vader)}`, polarityColor);
    tile(ctx, 968, 250, "COMMENTS", v.totalRecords.toLocaleString(), `${v.uniqueRecords.toLocaleString()} unique`, C.text);
    tile(ctx, 780, 358, "DOMINANT EMOTION", v.emotion ?? "n/a", v.emotionShare !== null ? `${Math.round(v.emotionShare * 100)}% of comments` : "not available", C.text);
    tile(ctx, 968, 358, "TOP CONFLICT", v.conflict ?? "None detected", v.conflict ? "most represented" : "no conflict terms found", C.text);
    label(ctx, "SENTIMENT SPLIT  ·  FULL DATASET", 60, 498);
    const segments = [
        { name: "negative", value: v.breakdown.negative, color: C.red },
        { name: "neutral", value: v.breakdown.neutral, color: C.blue },
        { name: "positive", value: v.breakdown.positive, color: C.green },
    ];
    const barX = 60;
    const barY = 512;
    const barW = 660;
    const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
    ctx.save();
    roundRect(ctx, barX, barY, barW, 18, 9);
    ctx.clip();
    ctx.fillStyle = "#1a2129";
    ctx.fillRect(barX, barY, barW, 18);
    let cursor = barX;
    for (const s of segments) {
        const segW = (s.value / total) * barW;
        ctx.fillStyle = s.color;
        ctx.fillRect(cursor, barY, segW, 18);
        cursor += segW;
    }
    ctx.restore();
    let legendX = 60;
    ctx.font = font(500, 13, MONO);
    for (const s of segments) {
        ctx.fillStyle = s.color;
        roundRect(ctx, legendX, 550, 10, 10, 2);
        ctx.fill();
        const text = `${s.value}% ${s.name}`;
        ctx.fillStyle = C.soft;
        ctx.fillText(text, legendX + 18, 560);
        legendX += 18 + ctx.measureText(text).width + 30;
    }
    label(ctx, "POLARITY TREND", 780, 498);
    sparkline(ctx, downsample(v.trend, 90).map((p) => p.polarity), 780, 512, 360, 54, C.amber);
    ctx.strokeStyle = "#1a2026";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 590.5);
    ctx.lineTo(1140, 590.5);
    ctx.stroke();
    ctx.font = font(400, 11.5, MONO);
    spacing(ctx, 1);
    ctx.fillStyle = C.dim;
    ctx.textAlign = "left";
    ctx.fillText(`RUN ${v.runId}  ·  VADER + TEXTBLOB CROSS-CHECKED`, 60, 614);
    ctx.textAlign = "right";
    ctx.fillStyle = v.agreement.agree ? C.muted : C.amber;
    ctx.fillText(`CONFIDENCE ${v.confidence.toUpperCase()}  ·  ${v.agreement.agree ? "MODELS AGREE" : "MODELS DISAGREE"}`, 1140, 614);
    spacing(ctx, 0);
    ctx.textAlign = "left";
}
async function ensureFonts() {
    if (typeof document === "undefined" || !document.fonts)
        return;
    try {
        await Promise.all([
            document.fonts.load(font(500, 20, "Inter")),
            document.fonts.load(font(700, 20, "Inter")),
            document.fonts.load(font(400, 14, '"JetBrains Mono"')),
            document.fonts.load(font(500, 14, '"JetBrains Mono"')),
            document.fonts.load(font(700, 14, '"JetBrains Mono"')),
        ]);
    }
    catch {
    }
}
export async function renderVerdictCard(v: Verdict): Promise<Blob> {
    await ensureFonts();
    const canvas = document.createElement("canvas");
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    const ctx = canvas.getContext("2d");
    if (!ctx)
        throw new Error("Your browser can't draw the verdict card.");
    ctx.scale(SCALE, SCALE);
    draw(ctx, v);
    return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image."))), "image/png"));
}
export function verdictFileName(v: Verdict, ext: string) {
    const slug = v.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "analysis";
    return `verdictlab-${slug}-${v.runId}.${ext}`;
}
export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
