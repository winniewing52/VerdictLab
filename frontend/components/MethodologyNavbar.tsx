import Link from "next/link";

export default function MethodologyNavbar() {
  return (
    <header className="methodology-navbar">
      <div className="methodology-navbar-brand">
        <div>V</div>
        <span>Verdict<span>Lab</span></span>
      </div>
      <nav>
        <Link href="/methodology#process">Methodology</Link>
        <Link href="/methodology#model-lab">Model lab</Link>
        <Link href="/methodology#models">The models</Link>
        <Link href="/methodology#trust">Trust &amp; limits</Link>
      </nav>
    </header>
  );
}
