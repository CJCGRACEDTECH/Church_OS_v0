import React from "react";
import { Link } from "wouter";
import { CalendarDays, HeartHandshake, ArrowRight } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function HomePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      {/* Nav */}
      <nav style={{ background: "#181d2e" }} className="flex items-center justify-between px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <img src={`${basePath}/cjc-logo.webp`} alt="CJC Church" className="h-10 w-auto" style={{ mixBlendMode: "screen" }} />
          <span className="text-white font-semibold text-base tracking-tight">CJC Church</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <Link href="/events" className="text-gray-400 text-sm hover:text-white transition-colors">Events</Link>
          <Link href="/connect" className="text-gray-400 text-sm hover:text-white transition-colors">Connect</Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="text-white text-sm border border-white/20 rounded-md px-4 py-1.5 hover:bg-white/10 transition-colors">
            Login
          </Link>
          <Link href="/member/give" className="bg-indigo-600 text-white text-sm rounded-md px-4 py-1.5 hover:bg-indigo-700 transition-colors font-medium">
            Give
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-4 py-28 md:py-40"
        style={{ background: "linear-gradient(135deg, #181d2e 0%, #1e2a4a 55%, #2d1f5e 100%)" }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 60% 40%, rgba(99,102,241,0.18) 0%, transparent 70%)" }} />
        <div className="relative max-w-2xl mx-auto">
          <span className="inline-block mb-4 rounded-full bg-indigo-600/20 border border-indigo-500/30 px-4 py-1 text-xs font-semibold text-indigo-300 uppercase tracking-widest">
            Christ Jesus Centered
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-5">
            Welcome to <span className="text-indigo-400">CJC Church</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8 leading-relaxed">
            A community centered on Jesus — growing in faith, love, and purpose together.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/connect"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-lg transition-colors text-sm"
            >
              Connect With Us <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/events"
              className="inline-flex items-center gap-2 border border-white/20 hover:bg-white/10 text-white font-medium px-6 py-3 rounded-lg transition-colors text-sm"
            >
              View Upcoming Events
            </Link>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6">

          <Link href="/events" className="group flex flex-col items-center text-center p-6 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all">
            <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3 group-hover:bg-indigo-100 transition-colors">
              <CalendarDays className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Events</h3>
            <p className="text-sm text-gray-500">Find out what&apos;s happening in the life of the church.</p>
          </Link>

          <Link href="/connect" className="group flex flex-col items-center text-center p-6 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all">
            <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3 group-hover:bg-indigo-100 transition-colors">
              <HeartHandshake className="h-6 w-6 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Connect</h3>
            <p className="text-sm text-gray-500">New here? Fill out a connect card and we&apos;ll reach out.</p>
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 px-4 text-center" style={{ background: "#181d2e" }}>
        <p className="text-gray-400 text-sm mb-3">Already a member?</p>
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-2 bg-white text-gray-900 font-medium px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors text-sm"
        >
          Sign in to Church OS <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <footer className="py-4 text-center text-xs text-gray-400 bg-white border-t border-gray-100">
        Church OS &middot; CJC Church
      </footer>
    </div>
  );
}
