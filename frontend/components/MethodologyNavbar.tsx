import Link from "next/link";

export default function MethodologyNavbar() {
  return (
    <header className="methodology-navbar">
      <div className="methodology-navbar-brand">
        <div>V</div>
        <span>Verdict<span>Lab</span></span>
      </div>
      <nav>
        <Link href="/methodology">Methodology</Link>
        <Link href="/workspace/access">Model lab</Link>
        <Link href="/workspace/access">The models</Link>
        <Link href="/methodology#trust">Trust &amp; limits</Link>
      </nav>
      <Link className="methodology-navbar-preview" href="#">PAGE PREVIEW</Link>
    </header>
  );
}
