import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
    title: "VerdictLab — ",
    description: "Decode the ground truth in Reddit, YouTube, and research datasets.",
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
