import type { PropertiesRow } from "@/modules/lib/database.types";
import { getSimilarListings } from "@/modules/listings/queries";
import { PropertyCard } from "@/modules/home/components/property-card";

/**
 * "Propiedades similares" section for the property detail page: active
 * listings of the same type/category in the same city, within ±25% of the
 * price, preferring the same colonia. Server component — renders nothing
 * when there are no matches.
 */
export async function SimilarProperties({
  listing,
}: {
  listing: PropertiesRow;
}) {
  const similares = await getSimilarListings(listing);

  if (similares.length === 0) return null;

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">Propiedades similares</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {similares.map((item) => (
          <PropertyCard key={item.id} listing={item} />
        ))}
      </div>
    </section>
  );
}
