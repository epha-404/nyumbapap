"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ListingCard } from "@/modules/listings/types";

const money = (amount: number) => `KSh ${amount.toLocaleString("en-KE")}`;

export type MarketplaceStats = { vacantHomes: number; townsCovered: number; verifiedLandlordPercent: number | null; successfulUnlocks: number };

export function Marketplace({ initialListings, stats }: { initialListings: ListingCard[]; stats: MarketplaceStats }) {
  const [town, setTown] = useState("all");
  const [type, setType] = useState("all");
  const [maxPrice, setMaxPrice] = useState(999999);
  const [selected, setSelected] = useState<ListingCard | null>(null);
  const [modal, setModal] = useState<"signin" | "list" | "safety" | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);
  const menuOpenedAtScrollY = useRef(0);
  const filtered = useMemo(() => initialListings.filter((item) => (town === "all" || item.town === town) && (type === "all" || item.unitType === type) && item.monthlyRentKes <= maxPrice), [initialListings, town, type, maxPrice]);
  const close = () => { setSelected(null); setModal(null); };
  const search = (event: FormEvent) => { event.preventDefault(); document.querySelector("#homes")?.scrollIntoView(); };
  useEffect(() => {
    if (!selected && !modal) return;
    dialogRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [selected, modal]);
  useEffect(() => {
    const closeAfterScroll = () => {
      const menu = mobileMenuRef.current;
      if (menu?.open && Math.abs(window.scrollY - menuOpenedAtScrollY.current) > 15) menu.open = false;
    };
    window.addEventListener("scroll", closeAfterScroll, { passive: true });
    return () => window.removeEventListener("scroll", closeAfterScroll);
  }, []);
  const closeMobileMenu = () => { if (mobileMenuRef.current) mobileMenuRef.current.open = false; };
  return <>
    <header className="topbar">
      <Link className="brand" href="/" aria-label="NyumbaPap home"><span className="brand-mark" aria-hidden="true">N</span><span>Nyumba<span>Pap</span></span></Link>
      <nav className="desktop-navigation" aria-label="Main navigation"><a href="#homes">Find a home</a><a href="#how">How it works</a><a href="#safety">Safety</a></nav>
      <div className="header-actions"><Link className="text-button" href="/login">Sign in</Link><button type="button" className="button small" onClick={() => setModal("list")}>List a property</button></div>
      <details ref={mobileMenuRef} className="mobile-navigation" onToggle={(event) => { if (event.currentTarget.open) menuOpenedAtScrollY.current = window.scrollY; }}>
        <summary>Menu</summary>
        <div id="mobile-navigation" className="mobile-menu" role="navigation" aria-label="Mobile navigation" onClick={closeMobileMenu}>
          <a href="#homes">Find a home</a>
          <a href="#how">How it works</a>
          <a href="#safety">Safety</a>
          <Link href="/login">Sign in</Link>
          <Link href="/register">Create account</Link>
          <Link className="button" href="/register?role=landlord">List a property</Link>
        </div>
      </details>
    </header>
    <main>
      <section className="hero"><div className="hero-copy"><div className="eyebrow">Verified rentals across Kenya</div><h1>Your next home is <em>closer</em> than you think.</h1><p>Discover genuinely vacant homes, compare rent and amenities, then unlock the exact location and landlord contact securely.</p><div className="trust-row"><span>✓ Verified listings</span><span>✓ M-Pesa payments</span><span>✓ No hidden agent fees</span></div></div>
        <form className="search-panel" onSubmit={search}><label>Where do you want to live?<select value={town} onChange={(e) => setTown(e.target.value)}><option value="all">All towns</option>{["Nairobi","Kiambu","Mombasa","Nakuru","Kisumu"].map(x => <option key={x}>{x}</option>)}</select></label><label>House type<select value={type} onChange={(e) => setType(e.target.value)}><option value="all">Any house type</option>{["Bedsitter","1 Bedroom","2 Bedroom","3 Bedroom"].map(x => <option key={x}>{x}</option>)}</select></label><label>Maximum monthly rent<select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}><option value="999999">Any budget</option><option value="15000">Up to KSh 15,000</option><option value="25000">Up to KSh 25,000</option><option value="40000">Up to KSh 40,000</option><option value="70000">Up to KSh 70,000</option></select></label><button className="button search">Search homes <span>→</span></button></form>
      </section>
      <section className="stats" aria-label="Marketplace statistics"><div><strong>{stats.vacantHomes.toLocaleString("en-KE")}</strong><span>vacant homes</span></div><div><strong>{stats.townsCovered.toLocaleString("en-KE")}</strong><span>towns covered</span></div><div><strong>{stats.verifiedLandlordPercent === null ? "—" : `${stats.verifiedLandlordPercent}%`}</strong><span>verified landlords</span></div><div><strong>{stats.successfulUnlocks.toLocaleString("en-KE")}</strong><span>successful unlocks</span></div></section>
      <section className="section" id="homes" aria-labelledby="homes-title"><div className="section-heading"><div><span className="eyebrow">Available now</span><h2 id="homes-title">Homes worth moving for</h2></div><p aria-live="polite">{filtered.length} available home{filtered.length === 1 ? "" : "s"}</p></div><div className="chips" aria-label="Filter by house type">{["all","Bedsitter","1 Bedroom","2 Bedroom","3 Bedroom"].map(x => <button type="button" aria-pressed={type === x} key={x} className={`chip ${type === x ? "active" : ""}`} onClick={() => setType(x)}>{x === "all" ? "All homes" : x}</button>)}</div><div className="property-grid">{filtered.map(p => <article className="property" key={p.id}><div className="photo" role="img" aria-label={`Preview of ${p.title}`} style={{ backgroundImage: `url('${p.imageUrl}')` }}>{p.verified && <span className="badge">{p.verificationLabel ?? "Verified listing"}</span>}<button type="button" className={`heart ${saved.has(p.id) ? "saved" : ""}`} aria-pressed={saved.has(p.id)} aria-label={`${saved.has(p.id) ? "Remove" : "Save"} ${p.title}`} onClick={() => setSaved(current => { const next = new Set(current); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); return next; })}>{saved.has(p.id) ? "♥" : "♡"}</button></div><div className="property-body"><span className="location">⌖ {p.approximateArea}, {p.town}</span><h3>{p.title}</h3><div className="facts"><span>▣ {p.unitType}</span><span>◫ {p.bathrooms} bath{p.bathrooms === 1 ? "" : "s"}</span><span>↔ {p.sizeSquareMetres} m²</span></div><div className="price">{money(p.monthlyRentKes)} <small>/ month</small></div><button type="button" className="property-action" onClick={() => setSelected(p)}>View details</button></div></article>)}</div>{filtered.length === 0 && <div className="empty"><h3>No exact matches yet</h3><p>Try a different town, home type, or price range.</p></div>}</section>
      <section className="how section" id="how"><div className="how-copy"><span className="eyebrow light">Simple and transparent</span><h2>From searching to viewing in three steps.</h2><p>We keep personal contact details private until a tenant is genuinely interested. A small one-time unlock fee reduces spam and fake enquiries.</p><button className="button light" onClick={() => document.querySelector("#homes")?.scrollIntoView()}>Explore homes</button></div><div className="steps">{[["01","Find your match","Filter verified vacancies by location, home type, rent, and amenities."],["02","Unlock securely","Pay the listing's displayed one-time fee through M-Pesa to reveal the precise location and owner contact."],["03","View and decide","Arrange a visit directly. Never pay a deposit before seeing the home."]].map(([n,h,p]) => <article key={n}><b>{n}</b><div><h3>{h}</h3><p>{p}</p></div></article>)}</div></section>
      <section className="landlord section"><div><span className="eyebrow">For property owners</span><h2>Fill your vacancy faster.</h2><p>Reach serious tenants, manage enquiries, and pay only a small publishing fee. Your first draft listing is free.</p><button className="button" onClick={() => setModal("list")}>List your property</button></div><div className="owner-card"><div className="owner-top"><span>Owner dashboard</span><span className="status">Live data</span></div><strong>Know how your listings perform</strong><p>See deduplicated listing views, paid contact unlocks, enquiries, and accepted viewing requests computed directly from marketplace activity.</p></div></section>
      <section className="safety section" id="safety"><span className="shield">✓</span><div><span className="eyebrow">Move with confidence</span><h2>Safety is built into every listing.</h2><p>Identity checks, property-document review, vacancy confirmation, user reports, and moderated contact help keep the marketplace trustworthy.</p></div><button className="outline-button" onClick={() => setModal("safety")}>See our safety rules</button></section>
    </main>
    <footer><Link className="brand inverse" href="/"><span className="brand-mark" aria-hidden="true">N</span><span>Nyumba<span>Pap</span></span></Link><p>Helping Kenyans find better homes, faster.</p><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/help">Help</Link></div><small>© 2026 NyumbaPap.</small></footer>
    {(selected || modal) && <div className="dialog-backdrop" onMouseDown={close}><div ref={dialogRef} className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="marketplace-dialog-title" onMouseDown={e => e.stopPropagation()}><button type="button" className="modal-close" aria-label="Close dialog" onClick={close}>x</button>{selected ? <><div className="modal-photo" role="img" aria-label={`Preview of ${selected.title}`} style={{backgroundImage:`url('${selected.imageUrl}')`}}/><div className="modal-inner"><span className="eyebrow">Verified vacancy</span><h2 id="marketplace-dialog-title">{selected.title}</h2><p className="modal-listing-facts"><span>⌖ {selected.approximateArea}, {selected.town}</span><span>{selected.unitType}</span><span>{selected.bathrooms} bath{selected.bathrooms === 1 ? "" : "s"}</span><span>{selected.sizeSquareMetres} m²</span></p><div className="modal-price">{money(selected.monthlyRentKes)} <small>/ month</small></div><div className="unlock-box"><strong>Contact and exact location are protected</strong><span>The full listing shows every approved interior photo and the current one-time unlock fee.</span></div><Link className="button modal-listing-cta" href={"/listings/" + selected.id}>View photos and full details</Link></div></> : <div className="modal-inner"><span className="eyebrow">NyumbaPap foundation</span><h2 id="marketplace-dialog-title">{modal === "signin" ? "Sign in" : modal === "list" ? "List a vacant home" : "Five rules for a safer move"}</h2><p>{modal === "safety" ? "View in person, confirm identity, never pay before viewing, use traceable payments, and report suspicious listings." : "This production foundation intentionally does not simulate account or payment success. Credential-backed workflows are the next phase."}</p><button type="button" className="button" onClick={close}>I understand</button></div>}</div></div>}
  </>;
}
