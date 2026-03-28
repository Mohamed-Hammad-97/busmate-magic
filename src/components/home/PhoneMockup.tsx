import { Bell, MessageSquare, ChevronRight, Home, MapPin, Clock, User } from "lucide-react";

const PhoneMockup = () => {
  return (
    <div className="relative mx-auto" style={{ width: 320, height: 692 }}>
      {/* Phone Frame */}
      <div
        className="w-full h-full rounded-[40px] overflow-hidden relative flex flex-col"
        style={{
          boxShadow: "0 0 0 8px #1a1a1a, 0 0 0 10px #333, 0 20px 60px rgba(0,0,0,0.3)",
          background: "#fff",
        }}
      >
        {/* Notch */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 z-[100]"
          style={{
            width: 100,
            height: 28,
            background: "#1a1a1a",
            borderRadius: "0 0 18px 18px",
          }}
        />

        {/* Screen */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden relative"
          style={{
            scrollbarWidth: "none",
            background:
              "radial-gradient(circle at 80% 20%, rgba(37,99,235,0.04) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(16,185,129,0.03) 0%, transparent 50%), linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)",
          }}
        >
          {/* Header */}
          <div
            className="relative overflow-hidden z-[1]"
            style={{
              padding: "44px 20px 14px",
              background: "linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)",
            }}
          >
            <div className="absolute -top-8 -right-6 w-32 h-32 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)" }} />
            <div className="flex justify-between items-center mb-3 relative z-[2]">
              <span className="text-white font-extrabold text-xl tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Seater</span>
              <div className="flex gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center relative" style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <Bell className="w-4 h-4 text-white" />
                  <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-blue-600" />
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
              </div>
            </div>
            <div className="relative z-[2]">
              <div className="text-[11px] text-white/70 font-light tracking-wide">Good Morning 👋</div>
              <div className="text-lg font-bold text-white mt-0.5" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Welcome Back!</div>
            </div>
          </div>

          {/* Services */}
          <div className="p-4 pb-0 relative z-[1]">
            <div className="text-[15px] font-bold text-slate-900 mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Our Services</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { emoji: "🚌", name: "School Bus", desc: "Daily student rides", bg: "#EFF6FF" },
                { emoji: "📍", name: "Live Tracking", desc: "Real-time GPS", bg: "#ECFDF5" },
                { emoji: "🚐", name: "Work Bus", desc: "Corporate shuttle", bg: "#FFFBEB" },
                { emoji: "🚎", name: "Special Request", desc: "Custom trips", bg: "#F5F3FF" },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 text-center border border-slate-100 shadow-[0_1px_4px_rgba(15,23,42,0.04)] hover:-translate-y-1 hover:shadow-md transition-all duration-300 cursor-pointer">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2 text-2xl" style={{ background: s.bg }}>{s.emoji}</div>
                  <div className="text-xs font-semibold text-slate-900">{s.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Ride */}
          <div className="px-4 pt-4 relative z-[1]">
            <div className="text-[15px] font-bold text-slate-900 mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Active Ride</div>
          </div>
          <div className="mx-4 rounded-[20px] p-4 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}>
            <div className="absolute -top-6 -right-4 w-20 h-20 rounded-full" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)" }} />
            <div className="flex justify-between items-center mb-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold text-emerald-300" style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
                <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse" />
                On the Way
              </div>
              <span className="text-[11px] text-white/50">ETA 8:15 AM</span>
            </div>
            <div className="flex items-center gap-3 relative z-[2]">
              <div className="flex flex-col items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400 border-2 border-blue-400/30" />
                <div className="w-0.5 h-5 rounded-sm" style={{ background: "linear-gradient(to bottom, #3B82F6, #F59E0B)" }} />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-amber-400/30" />
              </div>
              <div className="flex-1 space-y-2.5">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-white/40 font-medium">Pickup</div>
                    <div className="text-[12px] font-semibold text-white">Zayed District 11</div>
                  </div>
                  <span className="text-[11px] text-blue-400 font-semibold">7:45 AM</span>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-white/40 font-medium">Drop-off</div>
                    <div className="text-[12px] font-semibold text-white">Collège Saint-Marc</div>
                  </div>
                  <span className="text-[11px] text-blue-400 font-semibold">8:15 AM</span>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming */}
          <div className="p-4 relative z-[1]">
            <div className="text-[15px] font-bold text-slate-900 mb-3" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Upcoming</div>
            <div className="space-y-2.5">
              {[
                { emoji: "🏫", title: "Afternoon Return", sub: "Today, 2:30 PM", bg: "#DBEAFE" },
                { emoji: "🌅", title: "Tomorrow Morning", sub: "Tomorrow, 7:30 AM", bg: "#FEF3C7" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-3 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: item.bg }}>{item.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-900">{item.title}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{item.sub}</div>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-4" />
        </div>

        {/* Bottom Nav */}
        <div className="flex justify-around items-end px-6 pt-2.5 pb-5 bg-white flex-shrink-0 relative" style={{ boxShadow: "0 -4px 20px rgba(15,23,42,0.05)" }}>
          <div className="absolute top-0 left-5 right-5 h-px" style={{ background: "linear-gradient(90deg, transparent, #E2E8F0, transparent)" }} />
          {[
            { icon: Home, label: "Home", active: true },
            { icon: MapPin, label: "Track", active: false },
            { icon: Clock, label: "History", active: false },
            { icon: User, label: "Profile", active: false },
          ].map((nav, i) => (
            <div key={i} className="flex flex-col items-center gap-1 cursor-pointer px-3 py-1 rounded-xl">
              <div
                className={`flex items-center justify-center rounded-xl transition-all ${
                  nav.active
                    ? "w-11 h-11 bg-blue-600 -translate-y-1.5 shadow-lg shadow-blue-600/35"
                    : "w-9 h-9 bg-slate-100"
                }`}
              >
                <nav.icon className={`${nav.active ? "w-5 h-5 text-white" : "w-4.5 h-4.5 text-slate-500"}`} />
              </div>
              <span className={`text-[9px] font-medium ${nav.active ? "text-blue-600 font-bold" : "text-slate-500"}`}>{nav.label}</span>
              {nav.active && <div className="w-1 h-1 rounded-full bg-blue-600 -mt-0.5" />}
            </div>
          ))}
        </div>

        {/* Home Indicator */}
        <div className="w-28 h-1 bg-slate-900 rounded-full mx-auto -mt-2.5 mb-1.5" />
      </div>
    </div>
  );
};

export default PhoneMockup;
