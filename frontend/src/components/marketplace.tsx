"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ListingCard } from "@/modules/listings/types";
import { listingCardsFromApi, type PublicListingsPayload } from "@/modules/listings/public-api";

const money = (amount: number) => `KSh ${amount.toLocaleString("en-KE")}`;

export type MarketplaceStats = { vacantHomes: number; townsCovered: number; verifiedLandlordPercent: number | null; successfulUnlocks: number };
const SEARCH_SESSION_KEY = "nyumbapap.marketplace-search.v1";
const budgetOptions = [10000, 15000, 25000, 40000, 70000, 100000];

export function Marketplace({ initialListings, initialTowns, stats }: { initialListings: ListingCard[]; initialTowns: string[]; stats: MarketplaceStats }) {
  const [listings, setListings] = useState(initialListings);
  const [towns, setTowns] = useState(initialTowns);
  const [town, setTown] = useState("all");
  const [type, setType] = useState("all");
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(999999);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selected, setSelected] = useState<ListingCard | null>(null);
  const [modal, setModal] = useState<"signin" | "list" | "safety" | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);
  const menuOpenedAtScrollY = useRef(0);
  const filtered = useMemo(() => listings.filter((item) => (town === "all" || item.town === town) && (type === "all" || item.unitType === type) && item.monthlyRentKes >= minPrice && item.monthlyRentKes <= maxPrice), [listings, town, type, minPrice, maxPrice]);
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
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(SEARCH_SESSION_KEY) ?? "null") as { town?: string; minPrice?: number; maxPrice?: number } | null;
      if (stored?.town) setTown(stored.town);
      if (Number.isFinite(stored?.minPrice)) setMinPrice(Number(stored?.minPrice));
      if (Number.isFinite(stored?.maxPrice)) setMaxPrice(Number(stored?.maxPrice));
    } catch {}
    setPreferencesReady(true);
  }, []);
  useEffect(() => {
    if (!preferencesReady) return;
    sessionStorage.setItem(SEARCH_SESSION_KEY, JSON.stringify({ town, minPrice, maxPrice }));
    const params = new URLSearchParams();
    if (town !== "all") params.set("town", town);
    if (minPrice > 0) params.set("minRent", String(minPrice));
    if (maxPrice < 999999) params.set("maxRent", String(maxPrice));
    const controller = new AbortController();
    setSearching(true);
    setSearchError("");
    fetch(`/api/listings?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Search request failed");
        return response.json() as Promise<PublicListingsPayload<MarketplaceStats>>;
      })
      .then(payload => { setListings(listingCardsFromApi(payload.data)); setTowns(payload.towns); })
      .catch(error => { if (error instanceof Error && error.name !== "AbortError") setSearchError("Could not refresh search results. Please try again."); })
      .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    return () => controller.abort();
  }, [preferencesReady, town, minPrice, maxPrice]);
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
        <form className="search-panel" onSubmit={search}>
          <label>Where do you want to live?<select value={town} onChange={(event) => setTown(event.target.value)}><option value="all">All towns</option>{towns.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>House type<select value={type} onChange={(event) => setType(event.target.value)}><option value="all">Any house type</option>{["Bedsitter", "1 Bedroom", "2 Bedroom", "3 Bedroom"].map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Minimum monthly rent<select value={minPrice} onChange={(event) => { const value = Number(event.target.value); setMinPrice(value); if (value > maxPrice) setMaxPrice(value); }}><option value="0">No minimum</option>{budgetOptions.map(value => <option key={value} value={value}>From KSh {value.toLocaleString("en-KE")}</option>)}</select></label>
          <label>Maximum monthly rent<select value={maxPrice} onChange={(event) => { const value = Number(event.target.value); setMaxPrice(value); if (value < minPrice) setMinPrice(value); }}><option value="999999">No maximum</option>{budgetOptions.map(value => <option key={value} value={value}>Up to KSh {value.toLocaleString("en-KE")}</option>)}</select></label>
          <button className="button search">Search homes <span>→</span></button>
        </form>
      </section>
      <section className="stats" aria-label="Marketplace statistics"><div><strong>{stats.vacantHomes.toLocaleString("en-KE")}</strong><span>vacant homes</span></div><div><strong>{stats.townsCovered.toLocaleString("en-KE")}</strong><span>towns covered</span></div><div><strong>{stats.verifiedLandlordPercent === null ? "—" : `${stats.verifiedLandlordPercent}%`}</strong><span>verified landlords</span></div><div><strong>{stats.successfulUnlocks.toLocaleString("en-KE")}</strong><span>successful unlocks</span></div></section>
      <section className="section" id="homes" aria-labelledby="homes-title"><div className="section-heading"><div><span className="eyebrow">Available now</span><h2 id="homes-title">Homes worth moving for</h2></div><p aria-live="polite">{searching ? "Searching…" : `${filtered.length} available home${filtered.length === 1 ? "" : "s"}`}</p></div>{searchError && <p className="form-error" role="alert">{searchError}</p>}<div className="chips" aria-label="Filter by house type">{["all","Bedsitter","1 Bedroom","2 Bedroom","3 Bedroom"].map(x => <button type="button" aria-pressed={type === x} key={x} className={`chip ${type === x ? "active" : ""}`} onClick={() => setType(x)}>{x === "all" ? "All homes" : x}</button>)}</div><div className="property-grid">{filtered.map(p => <article className="property" key={p.id}><div className="photo" role="img" aria-label={`Preview of ${p.title}`} style={{ backgroundImage: `url('${p.imageUrl}')` }}>{p.verified && <span className="badge">{p.verificationLabel ?? "Verified listing"}</span>}<button type="button" className={`heart ${saved.has(p.id) ? "saved" : ""}`} aria-pressed={saved.has(p.id)} aria-label={`${saved.has(p.id) ? "Remove" : "Save"} ${p.title}`} onClick={() => setSaved(current => { const next = new Set(current); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); return next; })}>{saved.has(p.id) ? "♥" : "♡"}</button></div><div className="property-body"><span className="location">⌖ {p.approximateArea}, {p.town}</span><h3>{p.title}</h3><div className="facts"><span>▣ {p.unitType}</span><span>◫ {p.bathrooms} bath{p.bathrooms === 1 ? "" : "s"}</span><span>↔ {p.sizeSquareMetres} m²</span></div><div className="price">{money(p.monthlyRentKes)} <small>/ month</small></div><button type="button" className="property-action" onClick={() => setSelected(p)}>View details</button></div></article>)}</div>{filtered.length === 0 && <div className="empty"><h3>No exact matches yet</h3><p>Try a different town, home type, or budget range.</p></div>}</section>
      <section className="how section" id="how"><div className="how-copy"><span className="eyebrow light">Simple and transparent</span><h2>From searching to viewing in three steps.</h2><p>We keep personal contact details private until a tenant is genuinely interested. A small one-time unlock fee reduces spam and fake enquiries.</p><button className="button light" onClick={() => document.querySelector("#homes")?.scrollIntoView()}>Explore homes</button></div><div className="steps">{[["01","Find your match","Filter verified vacancies by location, home type, rent, and amenities."],["02","Unlock securely","Pay the listing's displayed one-time fee through M-Pesa to reveal the precise location and owner contact."],["03","View and decide","Arrange a visit directly. Never pay a deposit before seeing the home."]].map(([n,h,p]) => <article key={n}><b>{n}</b><div><h3>{h}</h3><p>{p}</p></div></article>)}</div></section>
      <section className="landlord section"><div><span className="eyebrow">For property owners</span><h2>Fill your vacancy faster.</h2><p>Reach serious tenants, manage enquiries, and pay only a small publishing fee. Your first draft listing is free.</p><button className="button" onClick={() => setModal("list")}>List your property</button></div><div className="owner-card"><div className="owner-top"><span>Owner dashboard</span><span className="status">Live data</span></div><strong>Know how your listings perform</strong><p>See deduplicated listing views, paid contact unlocks, enquiries, and accepted viewing requests computed directly from marketplace activity.</p></div></section>
      <section className="safety section" id="safety"><span className="shield">✓</span><div><span className="eyebrow">Move with confidence</span><h2>Safety is built into every listing.</h2><p>Identity checks, property-document review, vacancy confirmation, user reports, and moderated contact help keep the marketplace trustworthy.</p></div><button className="outline-button" onClick={() => setModal("safety")}>See our safety rules</button></section>
    </main>
    <footer><Link className="brand inverse" href="/"><span className="brand-mark" aria-hidden="true">N</span><span>Nyumba<span>Pap</span></span></Link><p>Helping Kenyans find better homes, faster.</p><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/help">Help</Link></div><small>© 2026 NyumbaPap.</small></footer>
    {(selected || modal) && <div className="dialog-backdrop" onMouseDown={close}><div ref={dialogRef} className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="marketplace-dialog-title" onMouseDown={e => e.stopPropagation()}><button type="button" className="modal-close" aria-label="Close dialog" onClick={close}>x</button>{selected ? <><div className="modal-photo" role="img" aria-label={`Preview of ${selected.title}`} style={{backgroundImage:`url('${selected.imageUrl}')`}}/><div className="modal-inner"><span className="eyebrow">Verified vacancy</span><h2 id="marketplace-dialog-title">{selected.title}</h2><p className="modal-listing-facts"><span>⌖ {selected.approximateArea}, {selected.town}</span><span>{selected.unitType}</span><span>{selected.bathrooms} bath{selected.bathrooms === 1 ? "" : "s"}</span><span>{selected.sizeSquareMetres} m²</span></p><div className="modal-price">{money(selected.monthlyRentKes)} <small>/ month</small></div><div className="unlock-box"><strong>Contact and exact location are protected</strong><span>The full listing shows every approved interior photo and the current one-time unlock fee.</span></div><Link className="button modal-listing-cta" href={"/listings/" + selected.id}>View photos and full details</Link></div></> : <div className="modal-inner"><span className="eyebrow">NyumbaPap foundation</span><h2 id="marketplace-dialog-title">{modal === "signin" ? "Sign in" : modal === "list" ? "List a vacant home" : "Five rules for a safer move"}</h2><p>{modal === "safety" ? "View in person, confirm identity, never pay before viewing, use traceable payments, and report suspicious listings." : "This production foundation intentionally does not simulate account or payment success. Credential-backed workflows are the next phase."}</p><button type="button" className="button" onClick={close}>I understand</button></div>}</div></div>}
  </>;
}
