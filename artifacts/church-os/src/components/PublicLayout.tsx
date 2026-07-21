import { Link, useLocation } from "wouter";
import { Youtube, Instagram, MapPin, Clock, Menu, X } from "lucide-react";
import React from "react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const YOUTUBE_URL = import.meta.env.VITE_PUBLIC_CHURCH_YOUTUBE_URL || "https://www.youtube.com/@cjcinternational";
const INSTAGRAM_URL = import.meta.env.VITE_PUBLIC_CHURCH_INSTAGRAM_URL || "https://www.instagram.com/cjc.international/";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/sermons", label: "Sermons" },
  { href: "/events", label: "Events" },
  { href: "/giving", label: "Give" },
];

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-50 shadow-md" style={{ background: "#181d2e" }}>
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            <img
              src={`${basePath}/cjc-logo.webp`}
              alt="CJC Church"
              className="h-9 w-auto"
              style={{ mixBlendMode: "screen" }}
            />
            <span className="text-white font-semibold text-base tracking-tight hidden sm:block">
              CJC Church
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors ${
                  location === href
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/connect"
              className="hidden sm:inline-flex text-white text-sm border border-white/25 rounded-md px-4 py-1.5 hover:bg-white/10 transition-colors font-medium"
            >
              I'm New
            </Link>
            <Link
              href="/sign-in"
              className="text-sm text-white rounded-md px-4 py-1.5 font-medium transition-colors"
              style={{ background: "#2563eb" }}
            >
              Login
            </Link>
            <button
              className="md:hidden ml-1 text-gray-300 hover:text-white p-1"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 px-4 py-4 space-y-3" style={{ background: "#181d2e" }}>
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`block text-sm font-medium py-1 ${
                  location === href ? "text-white" : "text-gray-400"
                }`}
              >
                {label}
              </Link>
            ))}
            <Link
              href="/connect"
              onClick={() => setMobileOpen(false)}
              className="block text-sm font-medium py-1 text-blue-400"
            >
              I'm New Here
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="text-white" style={{ background: "#181d2e" }}>
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={`${basePath}/cjc-logo.webp`}
                  alt="CJC Church"
                  className="h-9 w-auto"
                  style={{ mixBlendMode: "screen" }}
                />
                <span className="font-semibold text-base">CJC Church</span>
              </div>
              <p className="text-gray-400 text-sm italic mb-1">One Kingdom. All Nations.</p>
              <p className="text-gray-500 text-sm">Christ Jesus Centered Church</p>
              <div className="flex items-center gap-3 mt-4">
                {YOUTUBE_URL && (
                  <a
                    href={YOUTUBE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="YouTube"
                  >
                    <Youtube className="h-5 w-5" />
                  </a>
                )}
                {INSTAGRAM_URL && (
                  <a
                    href={INSTAGRAM_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                    aria-label="Instagram"
                  >
                    <Instagram className="h-5 w-5" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">Visit Us</h3>
              <div className="flex items-start gap-2 text-gray-400 text-sm mb-3">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-400" />
                <div>
                  <p>7403 Boston Blvd</p>
                  <p>Springfield, VA 22153</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-gray-400 text-sm">
                <Clock className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-400" />
                <div className="space-y-0.5">
                  <p>Thursday &amp; Friday — 7:00 PM</p>
                  <p>Saturday — 6:00 PM</p>
                  <p>Sunday — 11:00 AM</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4">Quick Links</h3>
              <div className="space-y-2">
                {NAV_LINKS.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="block text-gray-400 text-sm hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                ))}
                <Link href="/connect" className="block text-gray-400 text-sm hover:text-white transition-colors">
                  Connect Card
                </Link>
                <Link href="/sign-in" className="block text-gray-400 text-sm hover:text-white transition-colors">
                  Member Login
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-gray-500 text-xs">
            <span>&copy; {new Date().getFullYear()} CJC Church — Christ Jesus Centered. All rights reserved.</span>
            <span>Powered by Church OS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
