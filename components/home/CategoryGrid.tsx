import { SectionHeader } from "@/components/ui/SectionHeader";
import { imageStyle } from "@/components/ui/placeholder";

export type CategoryTile = {
  id: string;
  title: string;
  /** Optional second line — "Need ideas?" uses it for the property count. */
  subtitle?: string;
  image?: string;
};

/**
 * Four photo tiles under a title. Covers both "Stay like a local in any
 * location" (title only, 20px radius) and "Need ideas?" (title + subtitle,
 * 16px radius) — the only differences between them in Figma.
 */
export function CategoryGrid({
  title,
  tiles,
  radius = 20,
}: {
  title: string;
  tiles: CategoryTile[];
  radius?: 16 | 20;
}) {
  return (
    <section className="flex flex-col gap-5">
      <SectionHeader title={title} />

      <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {tiles.map((tile) => (
          <a
            key={tile.id}
            href="#"
            style={{ borderRadius: radius }}
            className="group relative flex h-[280px] w-[285px] shrink-0 snap-start flex-col justify-end overflow-hidden p-4 sm:w-auto"
          >
            <span
              aria-hidden
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.04]"
              style={imageStyle(tile.image, tile.id)}
            />
            {/* Figma: transparent until 50.5%, then down to rgba(0,5,25,.9). */}
            <span
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,5,25,0)_50.545%,rgba(0,5,25,0.9)_100%)]"
            />

            <span className="relative flex flex-col gap-1 text-white">
              <span className="font-display text-[20px] font-bold tracking-[-0.4px]">
                {tile.title}
              </span>
              {tile.subtitle && (
                <span className="font-display text-[14px] tracking-[-0.28px] opacity-90">
                  {tile.subtitle}
                </span>
              )}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
