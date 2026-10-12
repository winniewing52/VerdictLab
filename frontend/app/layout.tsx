import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
    title: "VerdictLab — Evidence before certainty",
    description: "Turn public conversations into explainable signals you can trace back to evidence.",
};
export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: "#0A0A0B",
};
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) {
    return (<html lang="en">
      <body>{children}</body>
    </html>);
}
