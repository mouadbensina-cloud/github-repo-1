import { HeroSection } from "@/components/hero/HeroSection";
import { RecentSearchSection } from "@/components/search/RecentSearchSection";
import { PropertyCarousel } from "@/components/property/PropertyCarousel";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { getExploreTiles } from "@/lib/explore-locations";
import { getFeaturedHotels } from "@/lib/featured-hotels";
import { getNearbyHotels } from "@/lib/nearby-hotels";
import { getPropertyTypeTiles } from "@/lib/property-types";

export default async function Home() {
  // Every real LiteAPI property type, each illustrated by its own Pexels
  // photo — see lib/property-types.ts. Fetched here (a Server Component)
  // rather than through a client-side API route: nothing about this list is
  // interactive or user-specific, so there's no reason to ship a second
  // round trip for content that's already ready by the time the page
  // renders. Same reasoning for the featured/nearby hotels and "Need
  // ideas?" destinations just below.
  const [propertyTypeTiles, featuredHotels, nearbyHotels, exploreTiles] =
    await Promise.all([
      getPropertyTypeTiles(),
      getFeaturedHotels(),
      getNearbyHotels(),
      getExploreTiles(),
    ]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="flex-1">
        <HeroSection />

        {/* Figma spaces every home-page section 40px apart. */}
        <Container className="mt-2 flex flex-col gap-10 pb-14">
          <RecentSearchSection />

          <PropertyCarousel
            title="Travelers also booked"
            properties={featuredHotels}
          />

          <CategoryGrid
            title="Stay like a local in any location"
            tiles={propertyTypeTiles}
          />

          <PropertyCarousel title="Nearby hotels" properties={nearbyHotels} />

          <CategoryGrid title="Need ideas ?" tiles={exploreTiles} radius={16} />
        </Container>
      </main>

      <Footer />
    </div>
  );
}
