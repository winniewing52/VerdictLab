import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import MarqueeStrip from "@/components/MarqueeStrip";
import FiveLenses from "@/components/FiveLenses";
import TrustMoment from "@/components/TrustMoment";
export default function HomePage() {
    return (<main className="min-h-screen bg-ink text-foreground">
      <Navbar />
      <Hero />
      <TrustMoment />
      <MarqueeStrip />
      <FiveLenses />
    </main>);
}
