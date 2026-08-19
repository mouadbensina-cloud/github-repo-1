import { Container } from "@/components/ui/Container";

const LINKS = [
  { label: "Terms and conditions", href: "#" },
  { label: "Privacy policy", href: "#" },
  { label: "Contact us", href: "#" },
];

export function Footer() {
  return (
    <footer className="border-t border-[#f2f3f5] bg-white py-[30px]">
      <Container className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-10 gap-y-2 font-display text-[13px] leading-5">
          <span className="text-neutral-500">© WhiteLabel, 2026</span>
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="tracking-[-0.26px] text-neutral-800 hover:underline"
            >
              {link.label}
            </a>
          ))}
        </div>

        <button
          type="button"
          className="flex cursor-pointer items-center justify-center rounded-lg border border-neutral-200 px-4 py-2 font-display text-[13px] leading-5 tracking-[-0.26px] text-neutral-800 transition-colors hover:bg-surface"
        >
          Report a bug
        </button>
      </Container>
    </footer>
  );
}
