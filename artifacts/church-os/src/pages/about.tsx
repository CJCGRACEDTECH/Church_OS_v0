import { Link } from "wouter";
import { PublicLayout } from "@/components/PublicLayout";
import { ArrowRight, Heart, Globe, Users, BookOpen } from "lucide-react";

const VALUES = [
  {
    icon: BookOpen,
    title: "Word-Centered",
    desc: "Everything we do is rooted in Scripture. We teach the Word of God with clarity and conviction.",
  },
  {
    icon: Globe,
    title: "All Nations",
    desc: "We are a multicultural community welcoming people of every background, language, and culture.",
  },
  {
    icon: Heart,
    title: "Spirit-Filled",
    desc: "We move in the power of the Holy Spirit, believing in prayer, healing, and the gifts of God.",
  },
  {
    icon: Users,
    title: "Family",
    desc: "We build strong families and authentic community — loving one another as Christ loved us.",
  },
];

export default function AboutPage() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-20 px-4 text-center" style={{ background: "#181d2e" }}>
        <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-4">Our Story</p>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
          About CJC Church
        </h1>
        <p className="text-gray-400 max-w-xl mx-auto text-base leading-relaxed">
          Christ Jesus Centered Church is a Spirit-filled, Word-based community built on one mission —
          One Kingdom. All Nations.
        </p>
      </section>

      {/* Mission */}
      <section className="py-16 px-4 bg-white">
        <div className="mx-auto max-w-4xl">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">
                Our Mission
              </p>
              <h2 className="text-3xl font-bold text-gray-900 mb-5 leading-snug">
                Making Disciples.<br />Building Families.<br />Advancing the Kingdom.
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">
                CJC Church exists to make disciples of Jesus Christ across every nation, culture, and
                language. We believe the church is most powerful when it reflects the full diversity of
                God's family — united by the Spirit, grounded in the Word.
              </p>
              <p className="text-gray-600 text-sm leading-relaxed">
                Whether you're new to faith or have walked with God for years, you'll find a home here.
                We are committed to discipleship, prayer, worship, and raising up leaders who carry the
                Gospel to the ends of the earth.
              </p>
            </div>
            <div
              className="rounded-2xl p-8 text-white"
              style={{ background: "#1e2d5a" }}
            >
              <p className="text-4xl font-bold italic text-blue-300 mb-4">"</p>
              <p className="text-lg leading-relaxed text-blue-100 font-medium mb-4">
                One Kingdom. All Nations.
              </p>
              <p className="text-gray-400 text-sm leading-relaxed">
                We are one body, many members — diverse in background, united in Christ. This is the
                vision of CJC Church: a church without walls, reaching every nation with the love of
                Jesus.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">What We Believe</p>
            <h2 className="text-3xl font-bold text-gray-900">Our Core Values</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-xl border border-gray-100 p-6 text-center hover:shadow-md transition-shadow">
                <div
                  className="h-12 w-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "#eff6ff", color: "#2563eb" }}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section className="py-16 px-4 bg-white">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">Leadership</p>
          <h2 className="text-3xl font-bold text-gray-900 mb-10">Our Pastor</h2>
          <div className="flex flex-col items-center">
            <div
              className="h-24 w-24 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-4 shadow-lg"
              style={{ background: "linear-gradient(135deg, #1e40af, #2563eb)" }}
            >
              PY
            </div>
            <h3 className="text-xl font-bold text-gray-900">Prophet Yosef</h3>
            <p className="text-blue-600 text-sm font-medium mt-1 mb-3">Lead Pastor &amp; Founder</p>
            <p className="text-gray-500 text-sm leading-relaxed max-w-md">
              Prophet Yosef is the founder and lead pastor of CJC Church. With a heart for the nations
              and a deep passion for the Word of God, he leads CJC in its mission to reach every people
              group with the Gospel of Jesus Christ.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4" style={{ background: "#181d2e" }}>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Join the Family?</h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-8 max-w-md mx-auto">
            We'd love to connect with you. Fill out a connect card and our team will reach out.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/connect"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 text-white font-semibold rounded-lg transition-colors"
              style={{ background: "#2563eb" }}
            >
              Connect With Us <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/sermons"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 border border-white/25 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
            >
              Watch a Sermon
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
