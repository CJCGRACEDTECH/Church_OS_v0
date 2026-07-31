type PublicSiteHeaderProps = {
  basePath?: string;
  publicWebsiteUrl?: string | null;
  givingUrl: string;
};

export function PublicSiteHeader({
  basePath = "",
  publicWebsiteUrl,
  givingUrl,
}: PublicSiteHeaderProps) {
  const website = publicWebsiteUrl?.replace(/\/+$/, "") || null;
  const websiteHref = (path = "") => (website ? `${website}${path}` : path || "/");
  const links = [
    { label: "Home", href: websiteHref() },
    { label: "About", href: websiteHref("/about") },
    { label: "Watch", href: websiteHref("/watch") },
    { label: "Events", href: websiteHref("/events") },
    { label: "Contact", href: websiteHref("/contact") },
  ];

  return (
    <header className="relative z-50 border-b border-white/10 bg-[#12172a]/95 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1240px] items-center gap-6 px-5 lg:px-7">
        <a href={websiteHref()} className="flex shrink-0 items-center gap-2.5 text-white">
          <img src={`${basePath}/cjc-logo.webp`} alt="" className="h-10 w-10 object-contain" />
          <span className="text-lg font-bold tracking-normal">CJC Church</span>
        </a>

        <nav className="ml-auto hidden items-center gap-6 md:flex" aria-label="Primary navigation">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="relative text-sm font-semibold tracking-normal text-[#cbd1df] transition-colors after:absolute after:-bottom-2.5 after:inset-x-0 after:h-0.5 after:origin-left after:scale-x-0 after:bg-[#c29b34] after:transition-transform hover:text-white hover:after:scale-x-100"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
          <a
            href={`${basePath}/sign-in`}
            aria-current="page"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#4760ff] px-[18px] text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[#3951e7] hover:shadow-lg"
          >
            Login
          </a>
          <a
            href={givingUrl}
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#c29b34] px-[18px] text-sm font-bold text-[#171c2c] transition-all hover:-translate-y-0.5 hover:bg-[#d0aa42] hover:shadow-lg"
          >
            Give
          </a>
        </div>

        <details className="relative ml-auto md:hidden">
          <summary
            className="flex h-10 w-10 cursor-pointer list-none flex-col items-center justify-center gap-[5px] rounded-md [&::-webkit-details-marker]:hidden"
            aria-label="Open navigation"
          >
            <span className="h-0.5 w-[22px] rounded bg-white" />
            <span className="h-0.5 w-[22px] rounded bg-white" />
            <span className="h-0.5 w-[22px] rounded bg-white" />
          </summary>
          <nav
            className="absolute right-0 top-12 w-[220px] rounded-md border border-gray-200 bg-white p-2.5 shadow-xl"
            aria-label="Mobile navigation"
          >
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="block rounded px-3 py-2.5 text-sm font-semibold text-[#20283a] hover:bg-[#eef3ff]"
              >
                {link.label}
              </a>
            ))}
            <a
              href={`${basePath}/sign-in`}
              aria-current="page"
              className="mt-1.5 block rounded bg-[#4760ff] px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-[#3951e7]"
            >
              Login
            </a>
            <a
              href={givingUrl}
              className="mt-1.5 block rounded bg-[#c29b34] px-3 py-2.5 text-center text-sm font-bold text-[#171c2c] hover:bg-[#d0aa42]"
            >
              Give
            </a>
          </nav>
        </details>
      </div>
    </header>
  );
}
