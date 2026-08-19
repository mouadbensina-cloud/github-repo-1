import { HeroSection } from "@/components/hero/HeroSection";
import {
  ContinueSearching,
  type LastSearch,
} from "@/components/search/ContinueSearching";
import { PropertyCarousel } from "@/components/property/PropertyCarousel";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import {
  NEARBY_HOTELS,
  NEED_IDEAS,
  STAY_LIKE_A_LOCAL,
  TRAVELERS_ALSO_BOOKED,
} from "@/lib/home-data";

// Placeholder until the last-search endpoint exists — swap this for the fetched
// result and the section renders it as-is.
const LAST_SEARCH: LastSearch = {
  category: "Stays",
  destination: "Paris",
  dateLabel: "Aug 18 - 19",
  guestLabel: "1 guest",
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="flex-1">
        <HeroSection />

        {/* Figma spaces every home-page section 40px apart. */}
        <Container className="mt-2 flex flex-col gap-10 pb-14">
          <div className="flex justify-center">
            <ContinueSearching search={LAST_SEARCH} />
          </div>

          <PropertyCarousel
            title="Travelers also booked"
            properties={TRAVELERS_ALSO_BOOKED}
          />

          <CategoryGrid
            title="Stay like a local in any location"
            tiles={STAY_LIKE_A_LOCAL}
          />

          <PropertyCarousel title="Nearby hotels" properties={NEARBY_HOTELS} />

          <CategoryGrid title="Need ideas ?" tiles={NEED_IDEAS} radius={16} />
        </Container>
      </main>

      <Footer />
    </div>
  );
}
