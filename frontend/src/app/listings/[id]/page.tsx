import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalNav } from "@/components/portal-nav";
import { backendFetch } from "@/lib/server-api";
import portal from "../../portal.module.css";
import detail from "./listing-detail.module.css";
import { ListingUnlock } from "@/components/listing-unlock";
import { formatLocationLabel } from "@/modules/listings/location-label";

type ListingDetail = {
  id: string;
  title: string;
  description: string;
  badge: { label: string; state: string; expiresAt: string | null };
  landlordBadge?: { label: string; state: "verified" | "unverified" } | null;
  unit: {
    unitType: string;
    bedrooms: number;
    bathrooms: number;
    sizeSquareMetres: number | null;
    monthlyRentKes: number;
    depositKes: number | null;
    amenities: unknown;
    property: { county: string; town: string; approximateArea: string };
  };
  images: Array<{ id: string; url: string; width: number; height: number }>;
  unlockFeeKes: number;
  hasPaidUnlock: boolean;
  signedIn: boolean;
};

export const dynamic = "force-dynamic";

export default async function PublicListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await backendFetch(`listings/${id}`);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Could not load listing");
  const { listing } = await response.json() as { listing: ListingDetail };
  const amenities = Array.isArray(listing.unit.amenities)
    ? listing.unit.amenities.filter((item): item is string => typeof item === "string")
    : [];

  return <div className={portal.page}>
    <PortalNav signedIn={listing.signedIn} />
    <main className={portal.main}>
      <Link href="/#homes">Back to listings</Link>
      <div className={portal.header}>
        <div>
          <span className={portal.eyebrow}>Public listing</span>
          {(listing.badge.state === "verified" || listing.badge.state === "expiring") && <span className={portal.badge}>{listing.badge.label}{listing.badge.state === "expiring" ? " - expiring soon" : ""}</span>}
          {listing.landlordBadge && <span className={`landlord-verification ${listing.landlordBadge.state}`}>{listing.landlordBadge.label}</span>}
          <h1 className={portal.title}>{listing.title}</h1>
          <p className={portal.muted}>{formatLocationLabel(listing.unit.property.approximateArea, listing.unit.property.town, listing.unit.property.county)}</p>
        </div>
        <div className={portal.card}>
          <div className={portal.price}>KSh {listing.unit.monthlyRentKes.toLocaleString("en-KE")}</div>
          <span>per month</span>
        </div>
      </div>

      {listing.images.length
        ? <section className={detail.gallery} aria-label="Listing interior images">
            {listing.images.map((image) => <img
              key={image.id}
              className={detail.galleryImage}
              src={image.url}
              width={image.width}
              height={image.height}
              alt={`Interior of ${listing.title}`}
              loading="lazy"
            />)}
          </section>
        : <section className={portal.card}><p className={portal.muted}>No interior images have been uploaded yet.</p></section>}

      <section className={detail.detailLayout}>
        <article className={portal.card}>
          <h2>About this home</h2>
          <p className={portal.muted}>{listing.description}</p>
          {amenities.length > 0 && <p><strong>Amenities:</strong> {amenities.join(", ")}</p>}
        </article>
        <aside className={`${portal.card} ${detail.factsCard}`}>
          <h2>Property facts</h2>
          <p>{listing.unit.unitType}</p>
          <p>{listing.unit.bedrooms} bedroom{listing.unit.bedrooms === 1 ? "" : "s"}</p>
          <p>{listing.unit.bathrooms} bathroom{listing.unit.bathrooms === 1 ? "" : "s"}</p>
          {listing.unit.sizeSquareMetres && <p>{listing.unit.sizeSquareMetres} square metres</p>}
          {listing.unit.depositKes !== null && <p>Deposit: KSh {listing.unit.depositKes.toLocaleString("en-KE")}</p>}
          <div className={detail.unlockAction}>
            <ListingUnlock listingId={listing.id} feeKes={listing.unlockFeeKes} signedIn={listing.signedIn} initiallyUnlocked={listing.hasPaidUnlock} />
          </div>
        </aside>
      </section>
    </main>
  </div>;
}
