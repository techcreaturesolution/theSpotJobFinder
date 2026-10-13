import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import FadeInSection from '../components/FadeInSection.jsx';

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [highestStep, setHighestStep] = useState(0);
  const stepCardRefs = useRef([]);

  useEffect(() => {
    const handleScroll = () => {
      const triggerPoint = window.innerHeight * 0.72;
      let current = 0;
      stepCardRefs.current.forEach((el, index) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top <= triggerPoint) {
          current = index;
        }
      });
      setHighestStep(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAction = () => {
    if (user) {
      navigate('/');
    } else {
      navigate('/login');
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (user) {
      navigate(searchQuery.trim() ? `/?q=${encodeURIComponent(searchQuery.trim())}` : '/');
    } else {
      navigate('/login');
    }
  };

  const steps = [
    {
      title: 'Choose your role',
      desc: 'Pick Fresher or Experienced & target qualification',
      icon: (
        <svg className="w-5 h-5 text-[#6355d8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      bg: 'bg-[#f3eefe]',
    },
    {
      title: 'Multi-source scan',
      desc: 'Scan Google Jobs, LinkedIn & top Indian portals',
      icon: (
        <svg className="w-5 h-5 text-[#6355d8]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      ),
      bg: 'bg-[#ede9fe]',
    },
    {
      title: 'Live verification',
      desc: 'AI checks original source page to ensure position is open',
      icon: (
        <svg className="w-5 h-5 text-[#6355d8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      bg: 'bg-[#f3eefe]',
    },
    {
      title: 'Direct HR contact',
      desc: 'Access verified HR email, phone & walk-in details',
      icon: (
        <svg className="w-5 h-5 text-[#6355d8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      ),
      bg: 'bg-[#ede9fe]',
    },
    {
      title: 'Achieve your goals',
      desc: 'Apply directly with 1-click and get hired fast',
      icon: (
        <svg className="w-5 h-5 text-[#6355d8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
      bg: 'bg-[#f3eefe]',
    },
  ];

  const categories = [
    {
      title: 'Development',
      count: '1,800+ Jobs',
      icon: (
        <svg className="w-6 h-6 text-[#6355d8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
      color: 'bg-[#ede9fe] border-purple-100',
    },
    {
      title: 'Design & UI',
      count: '450+ Jobs',
      icon: (
        <svg className="w-6 h-6 text-[#6355d8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ),
      color: 'bg-[#ede9fe] border-purple-100',
    },
    {
      title: 'Business & Accounts',
      count: '950+ Jobs',
      icon: (
        <svg className="w-6 h-6 text-[#6355d8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      color: 'bg-[#ede9fe] border-purple-100',
    },
    {
      title: 'Sales & Marketing',
      count: '1,200+ Jobs',
      icon: (
        <svg className="w-6 h-6 text-[#6355d8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7c-.574 0-1.124.12-1.564.337z" />
        </svg>
      ),
      color: 'bg-[#ede9fe] border-purple-100',
    },
    {
      title: 'Data Science',
      count: '600+ Jobs',
      icon: (
        <svg className="w-6 h-6 text-[#6355d8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'bg-[#ede9fe] border-purple-100',
    },
    {
      title: 'Customer Support',
      count: '1,400+ Jobs',
      icon: (
        <svg className="w-6 h-6 text-[#6355d8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 18v-6a9 9 0 0118 0v6M3 18a3 3 0 003 3h1a1 1 0 001-1v-5a1 1 0 00-1-1H6a3 3 0 00-3 3zm18 0a3 3 0 01-3 3h-1a1 1 0 01-1-1v-5a1 1 0 011-1h1a3 3 0 013 3z" />
        </svg>
      ),
      color: 'bg-[#ede9fe] border-purple-100',
    },
  ];

  const testimonials = [
    {
      name: 'Rahul M.',
      role: 'Fresher React Developer',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      text: 'TheSpot JobFinder changed the way I look for jobs. The direct HR contact was practical and got me hired in a week.',
    },
    {
      name: 'Lina R.',
      role: 'Junior Accounts Executive',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=faces',
      text: 'Great platform with live verified links. No expired or fake consultancy postings like other job portals!',
    },
    {
      name: 'Youssef A.',
      role: 'Full Stack Engineer',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
      text: 'The best job finder experience for freshers and experienced in India. Highly recommended for everyone.',
    },
  ];



  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#1e1b4b] font-sans antialiased selection:bg-[#6355d8] selection:text-white overflow-x-clip scroll-smooth">
      {/* Top Navbar: Fixed to top so it stays stable while scrolling */}
      <header className="fixed top-0 inset-x-0 z-50 bg-[#faf8ff]/90 backdrop-blur-md border-b border-[#f0eaff] shadow-[0_2px_12px_rgba(99,85,216,0.04)] transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-12 py-3 sm:py-3.5 anim-nav-drop">
          {/* Brand Logo */}
          <Link
            to="/landing"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center transition hover:opacity-90"
          >
            <img
              src="/final_logo_updated.png"
              alt="TheSpot JobFinder"
              className="h-9 sm:h-11 md:h-14 w-auto object-contain"
            />
          </Link>

          {/* Navigation Links with Bottom Underline on Hover (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            {[
              { name: 'Home', href: '#home' },
              { name: 'About Us', href: '#about' },
              { name: 'How It Works', href: '#how-it-works' },
              { name: 'Categories', href: '#categories' },
              { name: 'Testimonials', href: '#reviews' },
            ].map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="group relative py-1 text-slate-600 transition-colors duration-200"
              >
                <span className="transition-colors duration-200 group-hover:text-[#1e1b4b]">{item.name}</span>
                <span className="absolute bottom-0 left-0 h-[2.5px] w-0 bg-[#1e1b4b] rounded-full transition-all duration-300 ease-out group-hover:w-full" />
              </a>
            ))}
          </nav>

          {/* Right Action Buttons & Mobile Hamburger Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to={user ? '/' : '/login'}
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#6355d8] px-3.5 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-[#5243d2] transition card-hover-lift"
            >
              <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Job Find Here</span>
            </Link>

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex md:hidden items-center justify-center rounded-xl p-2 text-slate-600 hover:bg-[#ede9fe] hover:text-[#6355d8] transition focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#f0eaff] bg-[#faf8ff]/98 px-5 pt-3 pb-5 shadow-2xl backdrop-blur-xl">
            <nav className="flex flex-col space-y-2">
              {[
                { name: 'Home', href: '#home' },
                { name: 'About Us', href: '#about' },
                { name: 'How It Works', href: '#how-it-works' },
                { name: 'Categories', href: '#categories' },
                { name: 'Testimonials', href: '#reviews' },
              ].map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[#ede9fe] hover:text-[#6355d8] transition flex items-center justify-between"
                >
                  <span>{item.name}</span>
                  <span className="text-slate-400 text-xs">→</span>
                </a>
              ))}
            </nav>
          </div>
        )}
      </header>
      {/* Spacer to keep layout aligned with fixed header */}
      <div className="h-[68px] sm:h-[76px] md:h-[84px]" aria-hidden="true" />

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-24">
        {/* ==============================================================
            SECTION 1: HERO ORBIT SHOWCASE (MATCHING TARGET DESIGN)
            ============================================================== */}
        <FadeInSection id="home" className="pt-4 pb-4 lg:pt-8 lg:pb-8">
          <div className="grid gap-12 lg:grid-cols-12 items-center">
            {/* Left Content Column */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <h1 className="font-hero-headline text-3xl sm:text-5xl md:text-6xl lg:text-[4rem] xl:text-[4.4rem] font-bold text-[#1e1b4b] tracking-[-0.04em] leading-[1.1] anim-slide-up">
                Find your dream job <br className="hidden sm:inline" />
                <span className="font-serif italic font-normal text-[#6355d8]">&amp; make your goal.</span>
              </h1>
              <p className="max-w-lg text-sm sm:text-base text-slate-500 leading-relaxed anim-slide-up anim-delay-100">
                We are best global job finder Agency and millions of people liked and trusted our platform.
              </p>

              {/* Pill Search Bar */}
              <div className="relative pt-2 anim-slide-up anim-delay-200">
                <form onSubmit={handleSearchSubmit} className="flex items-center rounded-full bg-white p-1.5 sm:p-2 shadow-xl shadow-purple-500/10 border border-purple-100 transition-all focus-within:border-[#6355d8] focus-within:ring-4 focus-within:ring-[#6355d8]/10 max-w-lg">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search your keyword or job"
                    className="w-full bg-transparent px-3.5 sm:px-5 py-2 text-xs sm:text-base text-[#1e1b4b] placeholder-slate-400 outline-none"
                  />
                  <button
                    type="submit"
                    className="grid h-10 w-10 sm:h-12 sm:w-12 shrink-0 place-items-center rounded-full bg-[#6355d8] text-white shadow-md shadow-indigo-500/25 hover:bg-[#5243d2] transition transform hover:scale-105"
                    aria-label="Search"
                  >
                    <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </form>
              </div>

              {/* Social Proof: 45K+ Regular Users */}
              <div className="flex items-center gap-3 pt-2 anim-slide-up anim-delay-300">
                <div className="flex -space-x-2">
                  <img
                    className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover shadow-sm"
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=faces"
                    alt="User"
                  />
                  <img
                    className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover shadow-sm"
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=faces"
                    alt="User"
                  />
                  <img
                    className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover shadow-sm"
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces"
                    alt="User"
                  />
                  <img
                    className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover shadow-sm"
                    src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&h=80&fit=crop&crop=faces"
                    alt="User"
                  />
                </div>
                <div className="text-xs sm:text-sm text-slate-700 font-medium">
                  <span className="font-bold text-[#1e1b4b]">45K+</span> Regular User.{' '}
                  <span className="font-semibold text-[#6355d8] hover:underline cursor-pointer">
                    View Price Plan
                  </span>
                </div>
              </div>
            </div>

            {/* Right Visual Column: Orbital Showcase */}
            <div className="lg:col-span-6 relative flex items-center justify-center anim-slide-up anim-delay-200 w-full overflow-hidden sm:overflow-visible py-4 sm:py-6">
              <div className="relative flex h-[280px] w-[280px] min-[380px]:h-[320px] min-[380px]:w-[320px] sm:h-[420px] sm:w-[420px] lg:h-[480px] lg:w-[480px] items-center justify-center">
                {/* Outer Dashed Orbit Ring */}
                <div className="absolute inset-2 min-[380px]:inset-4 sm:inset-6 rounded-full border-2 border-dashed border-[#c4b5fd]/60" />
                {/* Secondary Orbit Subtle Ring */}
                <div className="absolute inset-10 min-[380px]:inset-14 sm:inset-20 rounded-full border border-purple-100/80" />

                {/* Central Circle with Girl Smiling & Pointing at Phone */}
                <div className="relative z-10 h-44 w-44 min-[380px]:h-52 min-[380px]:w-52 sm:h-68 sm:w-68 lg:h-80 lg:w-80 overflow-hidden rounded-full border-4 sm:border-8 border-white bg-gradient-to-tr from-[#ede9fe] to-[#faf8ff] shadow-2xl shadow-purple-900/15">
                  <img
                    src="/landing-orbit-hero.jpg"
                    alt="Find your dream job"
                    className="h-full w-full object-cover object-top hover:scale-105 transition-transform duration-700"
                  />
                </div>

                {/* Orbit Floating Icon Badges */}
                {/* 1. Pinterest (Top-Left) */}
                <div className="absolute top-4 left-4 min-[380px]:top-6 min-[380px]:left-6 sm:top-10 sm:left-10 z-20 grid h-9 w-9 min-[380px]:h-10 min-[380px]:w-10 sm:h-12 sm:w-12 place-items-center rounded-full bg-white shadow-xl shadow-purple-500/15 border border-purple-100 anim-float card-hover-lift">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#E60023]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
                  </svg>
                </div>

                {/* 2. Dribbble / Pink Globe (Top) */}
                <div className="absolute top-0 sm:top-2 left-1/2 -translate-x-1/2 z-20 grid h-8 w-8 min-[380px]:h-9 min-[380px]:w-9 sm:h-11 sm:w-11 place-items-center rounded-full bg-white shadow-xl shadow-purple-500/15 border border-purple-100 anim-float-reverse card-hover-lift">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#EA4C89]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.375 0 0 5.375 0 12c0 6.627 5.375 12 12 12 6.627 0 12-5.373 12-12 0-6.625-5.373-12-12-12zm8.537 6.442c1.47 1.636 2.363 3.774 2.457 6.126-1.503-.314-3.568-.506-6.04-.506-.285 0-.582.003-.878.009-.272-.647-.565-1.32-.882-2.016 3.016-1.344 4.887-2.923 5.343-3.613zm-7.61-3.376c3.218 0 6.074 1.572 7.828 3.987-.419.605-2.228 2.062-5.068 3.327-1.31-2.483-2.73-4.71-3.57-5.918.267-.024.536-.039.81-.039zm-2.85.748c.84 1.205 2.264 3.444 3.585 5.945-2.88 1.055-6.19 1.748-9.404 1.874 1.134-3.555 3.564-6.425 6.78-7.819H10.077zm-8.07 10.373c0-.184.008-.367.021-.548 3.435-.138 6.945-.884 10.02-2.008.286.634.551 1.25.797 1.841-3.235 2.016-6.138 4.954-7.886 8.441-1.83-2.064-2.952-4.757-2.952-7.726zm5.82 8.784c1.654-3.321 4.417-6.108 7.508-8.016 1.162 2.76 2.08 5.688 2.502 7.747-1.92 1.341-4.248 2.135-6.764 2.135-1.164 0-2.28-.168-3.246-.466zm11.758-2.09c-.394-1.854-1.253-4.577-2.355-7.228 2.274.004 4.195.176 5.568.455-.494 2.87-1.82 5.367-3.213 6.773z"/>
                  </svg>
                </div>

                {/* 3. Google (Top-Right) */}
                <div className="absolute top-4 right-4 min-[380px]:top-6 min-[380px]:right-6 sm:top-12 sm:right-10 z-20 grid h-9 w-9 min-[380px]:h-10 min-[380px]:w-10 sm:h-14 sm:w-14 place-items-center rounded-full bg-white shadow-xl shadow-purple-500/15 border border-purple-100 anim-float card-hover-lift">
                  <svg className="w-4 h-4 sm:w-6 sm:h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                </div>

                {/* 4. Twitter / Slack (Middle-Right) */}
                <div className="absolute top-1/2 -translate-y-1/2 -right-2 min-[380px]:-right-3 sm:-right-4 z-20 grid h-8 w-8 min-[380px]:h-9 min-[380px]:w-9 sm:h-11 sm:w-11 place-items-center rounded-full bg-white shadow-xl shadow-purple-500/15 border border-purple-100 anim-float-reverse card-hover-lift">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#1DA1F2]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.936 9.936 0 0024 4.59z"/>
                  </svg>
                </div>

                {/* 5. LinkedIn / Payoneer (Bottom-Right) */}
                <div className="absolute bottom-6 right-4 min-[380px]:bottom-8 min-[380px]:right-6 sm:bottom-12 sm:right-10 z-20 grid h-9 w-9 min-[380px]:h-10 min-[380px]:w-10 sm:h-12 sm:w-12 place-items-center rounded-full bg-white shadow-xl shadow-purple-500/15 border border-purple-100 anim-float card-hover-lift">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </div>

                {/* 6. Instagram (Bottom) */}
                <div className="absolute -bottom-2.5 min-[380px]:-bottom-3 sm:-bottom-4 left-1/2 -translate-x-1/2 z-20 grid h-9 w-9 min-[380px]:h-10 min-[380px]:w-10 sm:h-12 sm:w-12 place-items-center rounded-full bg-white shadow-xl shadow-purple-500/15 border border-purple-100 anim-float-reverse card-hover-lift">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#E4405F]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>

                {/* 7. Google Drive / Cloud (Bottom-Left) */}
                <div className="absolute bottom-6 left-4 min-[380px]:bottom-8 min-[380px]:left-6 sm:bottom-12 sm:left-10 z-20 grid h-8 w-8 min-[380px]:h-9 min-[380px]:w-9 sm:h-11 sm:w-11 place-items-center rounded-full bg-white shadow-xl shadow-purple-500/15 border border-purple-100 anim-float card-hover-lift">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24">
                    <path fill="#FFC107" d="M8.01 3.5l5.99 10.39-2.99 5.18-5.99-10.39z"/>
                    <path fill="#0066DA" d="M14 13.89h10l-3 5.18h-10z"/>
                    <path fill="#00AC47" d="M8.01 3.5h6l5.99 10.39h-6z"/>
                  </svg>
                </div>

                {/* 8. Slack (Middle-Left) */}
                <div className="absolute top-1/2 -translate-y-1/2 -left-2 min-[380px]:-left-3 sm:-left-4 z-20 grid h-8 w-8 min-[380px]:h-9 min-[380px]:w-9 sm:h-11 sm:w-11 place-items-center rounded-full bg-white shadow-xl shadow-purple-500/15 border border-purple-100 anim-float-reverse card-hover-lift">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#4A154B]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>



        {/* ==============================================================
            SECTION 2: WHO WE ARE (Staggered Waterfall & Floating Stat Badge)
            ============================================================== */}
        <FadeInSection id="about" className="grid gap-12 lg:grid-cols-12 items-center">
          {/* Left Visual Card */}
          <div className="lg:col-span-6 relative anim-slide-up anim-delay-200">
            <div className="relative overflow-hidden rounded-3xl bg-[#ede9fe]/60 p-4 border border-purple-100 shadow-md shadow-purple-500/5">
              <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-white shadow-sm">
                <img
                  src="/landing-about.jpg"
                  alt="Career team matching talent with genuine opportunities"
                  className="h-full w-full object-cover object-center transition-transform duration-700 hover:scale-105"
                />
              </div>
            </div>
          </div>

          {/* Right Content */}
          <div className="lg:col-span-6 space-y-6 anim-slide-up anim-delay-300">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-[#6355d8] mb-2">
                WHO WE ARE
              </div>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl xl:text-[3.25rem] font-extrabold text-[#1e1b4b] leading-[1.15]">
                Connecting real talent with{' '}
                <span className="font-serif italic font-normal text-[#6355d8]">verified careers</span>
              </h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              At TheSpot JobFinder, we eliminate fake consultancies, ghost openings, and hidden recruiter fees. Our intelligent multi-portal aggregation verifies each listing directly with company HRs across India — empowering freshers and experienced candidates to apply with complete trust and zero friction.
            </p>

            {/* Feature Highlights */}
            <div className="space-y-3 pt-1">
              <div className="flex items-start gap-3">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#ede9fe] text-[#6355d8] text-xs font-bold mt-0.5">
                  ✓
                </div>
                <div>
                  <h4 className="font-heading text-sm font-bold text-[#1e1b4b]">Direct Recruiter Access</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Reach official HR emails, verified phones, and walk-in interview venues directly without third-party middlemen.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#ede9fe] text-[#6355d8] text-xs font-bold mt-0.5">
                  ✓
                </div>
                <div>
                  <h4 className="font-heading text-sm font-bold text-[#1e1b4b]">AI-Verified Authentic Openings</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Every single listing is cross-checked word-for-word against official company career portals to guarantee open status.</p>
                </div>
              </div>
            </div>

            {/* 3 Metrics with Card Lift */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-4 pt-4 border-t border-purple-100 text-center sm:text-left">
              <div className="rounded-xl p-1.5 sm:p-2.5 transition hover:bg-white hover:shadow-sm">
                <div className="font-heading text-lg sm:text-2xl font-black text-[#1e1b4b]">500+</div>
                <div className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Hiring partners</div>
              </div>
              <div className="rounded-xl p-1.5 sm:p-2.5 transition hover:bg-white hover:shadow-sm">
                <div className="font-heading text-lg sm:text-2xl font-black text-[#1e1b4b]">10,000+</div>
                <div className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Live openings</div>
              </div>
              <div className="rounded-xl p-1.5 sm:p-2.5 transition hover:bg-white hover:shadow-sm">
                <div className="font-heading text-lg sm:text-2xl font-black text-[#1e1b4b]">100%</div>
                <div className="text-[10px] sm:text-xs text-slate-500 mt-0.5">Free for seekers</div>
              </div>
            </div>
          </div>
        </FadeInSection>

        {/* ==============================================================
            SECTION 3: PROCESS STEPPER / HOW IT WORKS (VERTICAL ZIGZAG)
            ============================================================== */}
        <FadeInSection id="how-it-works" className="py-10 flex flex-col justify-center items-center w-full">
          <h2 className="font-heading text-center text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold text-[#1e1b4b] inline-flex items-center justify-center flex-wrap gap-2.5">
            <span>Why job seekers love</span>
            <span className="font-serif italic font-normal text-[#6355d8]">TheSpot JobFinder</span>
          </h2>

          <div className="mt-14 max-w-4xl mx-auto w-full relative pb-8">
            <div className="relative flex flex-col space-y-6 sm:space-y-4">
              {steps.map((st, idx) => {
                const isRight = idx % 2 === 1;
                const isConnectorActive = highestStep > idx;
                const isCardActive = highestStep >= idx;

                return (
                  <div key={st.title} className="relative">
                    {/* Step Card Row in Vertical Alternating Zigzag */}
                    <div className={`flex w-full ${isRight ? 'sm:justify-end' : 'sm:justify-start'}`}>
                      <div
                        ref={(el) => (stepCardRefs.current[idx] = el)}
                        className={`relative w-full sm:w-[380px] md:w-[420px] rounded-2xl bg-white p-5 sm:p-6 shadow-md transition-all duration-500 group card-hover-lift ${
                          isCardActive
                            ? 'shadow-xl shadow-purple-500/15'
                            : 'shadow-purple-500/5'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`grid h-12 w-12 sm:h-14 sm:w-14 shrink-0 place-items-center rounded-2xl ${st.bg} shadow-sm group-hover:scale-105 transition-transform`}>
                            {st.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span
                              className={`inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full transition-all duration-300 ${
                                isCardActive
                                  ? 'text-white bg-[#6355d8] shadow-sm shadow-purple-500/25'
                                  : 'text-[#6355d8] bg-[#ede9fe]'
                              }`}
                            >
                              Step 0{idx + 1}
                            </span>
                            <h3 className={`font-heading text-base sm:text-lg font-bold transition mt-1.5 leading-snug ${
                              isCardActive ? 'text-[#6355d8]' : 'text-[#1e1b4b] group-hover:text-[#6355d8]'
                            }`}>
                              {st.title}
                            </h3>
                            <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed">
                              {st.desc}
                            </p>
                          </div>
                        </div>

                        {/* Curved Connector Line with Traveling Purple Dot (Left Card to Next Right Card) */}
                        {idx < steps.length - 1 && !isRight && (
                          <div className="hidden sm:block absolute left-full top-1/2 -mt-1 pointer-events-none z-20 overflow-visible">
                            <svg width="120" height="96" viewBox="0 0 120 96" fill="none" className="overflow-visible">
                              {/* Background subtle guide path */}
                              <path
                                d="M 0 0 L 70 0 Q 110 0 110 40 L 110 88"
                                stroke="#f0eaff"
                                strokeWidth="2"
                                strokeDasharray="4 4"
                                fill="none"
                              />
                              {/* Active drawing path on scroll */}
                              <path
                                d="M 0 0 L 70 0 Q 110 0 110 40 L 110 88"
                                stroke="#6355d8"
                                strokeWidth="2.5"
                                strokeDasharray="190"
                                strokeDashoffset={isConnectorActive ? 0 : 190}
                                style={{
                                  transition: 'stroke-dashoffset 0.85s cubic-bezier(0.16, 1, 0.3, 1)',
                                }}
                                fill="none"
                              />
                              {/* Purple Dot at Start (Right Edge of Left Card) */}
                              <circle
                                cx="0"
                                cy="0"
                                r="4.5"
                                fill={isConnectorActive ? "#6355d8" : "#c4b5fd"}
                                stroke="#ffffff"
                                strokeWidth="2"
                              />
                              {/* Purple Dot at End (Top of Next Card) */}
                              <circle
                                cx="110"
                                cy="88"
                                r="4.5"
                                fill={isConnectorActive ? "#6355d8" : "#e0e7ff"}
                                stroke="#ffffff"
                                strokeWidth="2"
                              />
                              {/* Pulsing ring on destination dot when active */}
                              {isConnectorActive && (
                                <circle cx="110" cy="88" r="8" fill="none" stroke="#a78bfa" strokeWidth="1.5" opacity="0.6" className="animate-ping" />
                              )}
                              {/* Traveling Purple Dot flowing along the path */}
                              {isConnectorActive && (
                                <g>
                                  <circle r="7" fill="#a78bfa" opacity="0.45">
                                    <animateMotion
                                      path="M 0 0 L 70 0 Q 110 0 110 40 L 110 88"
                                      dur="1.7s"
                                      repeatCount="indefinite"
                                    />
                                  </circle>
                                  <circle r="4.5" fill="#6355d8" stroke="#ffffff" strokeWidth="2">
                                    <animateMotion
                                      path="M 0 0 L 70 0 Q 110 0 110 40 L 110 88"
                                      dur="1.7s"
                                      repeatCount="indefinite"
                                    />
                                  </circle>
                                </g>
                              )}
                            </svg>
                          </div>
                        )}

                        {/* Curved Connector Line with Traveling Purple Dot (Right Card to Next Left Card) */}
                        {idx < steps.length - 1 && isRight && (
                          <div className="hidden sm:block absolute right-full top-1/2 -mt-1 pointer-events-none z-20 overflow-visible">
                            <svg width="120" height="96" viewBox="0 0 120 96" fill="none" className="overflow-visible">
                              {/* Background subtle guide path */}
                              <path
                                d="M 120 0 L 50 0 Q 10 0 10 40 L 10 88"
                                stroke="#f0eaff"
                                strokeWidth="2"
                                strokeDasharray="4 4"
                                fill="none"
                              />
                              {/* Active drawing path on scroll */}
                              <path
                                d="M 120 0 L 50 0 Q 10 0 10 40 L 10 88"
                                stroke="#6355d8"
                                strokeWidth="2.5"
                                strokeDasharray="190"
                                strokeDashoffset={isConnectorActive ? 0 : 190}
                                style={{
                                  transition: 'stroke-dashoffset 0.85s cubic-bezier(0.16, 1, 0.3, 1)',
                                }}
                                fill="none"
                              />
                              {/* Purple Dot at Start (Left Edge of Right Card) */}
                              <circle
                                cx="120"
                                cy="0"
                                r="4.5"
                                fill={isConnectorActive ? "#6355d8" : "#c4b5fd"}
                                stroke="#ffffff"
                                strokeWidth="2"
                              />
                              {/* Purple Dot at End (Top of Next Card) */}
                              <circle
                                cx="10"
                                cy="88"
                                r="4.5"
                                fill={isConnectorActive ? "#6355d8" : "#e0e7ff"}
                                stroke="#ffffff"
                                strokeWidth="2"
                              />
                              {/* Pulsing ring on destination dot when active */}
                              {isConnectorActive && (
                                <circle cx="10" cy="88" r="8" fill="none" stroke="#a78bfa" strokeWidth="1.5" opacity="0.6" className="animate-ping" />
                              )}
                              {/* Traveling Purple Dot flowing along the path */}
                              {isConnectorActive && (
                                <g>
                                  <circle r="7" fill="#a78bfa" opacity="0.45">
                                    <animateMotion
                                      path="M 120 0 L 50 0 Q 10 0 10 40 L 10 88"
                                      dur="1.7s"
                                      repeatCount="indefinite"
                                    />
                                  </circle>
                                  <circle r="4.5" fill="#6355d8" stroke="#ffffff" strokeWidth="2">
                                    <animateMotion
                                      path="M 120 0 L 50 0 Q 10 0 10 40 L 10 88"
                                      dur="1.7s"
                                      repeatCount="indefinite"
                                    />
                                  </circle>
                                </g>
                              )}
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </FadeInSection>

        {/* ==============================================================
            SECTION 4: POPULAR CATEGORIES (Interactive Pop & Hover Lift)
            ============================================================== */}
        <FadeInSection id="categories" className="space-y-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold text-[#1e1b4b]">
                Popular <span className="font-serif italic font-normal text-[#6355d8]">categories</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5">Explore high-demand openings across major sectors</p>
            </div>
            <Link to="/login" className="text-xs sm:text-sm font-bold text-[#6355d8] hover:underline flex items-center gap-1">
              View all jobs →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((cat, idx) => (
              <div
                key={cat.title}
                onClick={handleAction}
                style={{ animationDelay: `${idx * 80}ms` }}
                className="group cursor-pointer rounded-2xl bg-white p-4 sm:p-5 text-center border border-purple-100/80 shadow-md shadow-purple-500/5 card-hover-lift hover:border-[#6355d8]/40 hover:shadow-xl hover:shadow-purple-500/10 flex flex-col items-center justify-center aspect-square w-full transition-all duration-300"
              >
                <div className={`grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-2xl border ${cat.color} mb-2.5 sm:mb-3 group-hover:scale-110 transition duration-300 shadow-sm shrink-0`}>
                  {cat.icon}
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-[#1e1b4b] group-hover:text-[#6355d8] transition leading-tight line-clamp-1">{cat.title}</h3>
                <div className="text-[11px] font-medium text-slate-400 mt-1">{cat.count}</div>
              </div>
            ))}
          </div>
        </FadeInSection>

        {/* ==============================================================
            SECTION 5: SEARCH IN A SMARTER WAY (Device Mockup & Levitating Cards)
            ============================================================== */}
        <FadeInSection className="rounded-3xl bg-white p-8 sm:p-12 shadow-lg shadow-purple-500/5 border border-purple-100/80">
          <div className="grid gap-10 lg:grid-cols-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl xl:text-[3.25rem] font-extrabold text-[#1e1b4b] leading-[1.15]">
                Search in a <span className="font-serif italic font-normal text-[#6355d8]">smarter way</span>
              </h2>

              <ul className="space-y-3.5 text-sm text-slate-600">
                <li className="flex items-center gap-3">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#6355d8] text-white text-xs font-bold shadow-sm">✓</span>
                  Multi-source verified search (Google Jobs, LinkedIn, Portals)
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#6355d8] text-white text-xs font-bold shadow-sm">✓</span>
                  Direct HR email addresses, phones &amp; walk-in interviews
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#6355d8] text-white text-xs font-bold shadow-sm">✓</span>
                  Dedicated filters for 10th, 12th, Graduate, B.Com, B.Tech
                </li>
                <li className="flex items-center gap-3">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#6355d8] text-white text-xs font-bold shadow-sm">✓</span>
                  Zero agency commission, 100% free daily searches
                </li>
              </ul>

              <button
                type="button"
                onClick={handleAction}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#6355d8] px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-[#5243d2] transition card-hover-lift"
              >
                Try smart search now →
              </button>
            </div>

            {/* Stylized Device Wireframe Visual with Subtle Float */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="relative w-full max-w-md rounded-2xl bg-[#f8f5ff] p-6 border border-purple-200 anim-float">
                <div className="rounded-xl bg-white p-4 shadow-md border border-purple-100 transition hover:shadow-lg">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                    <span className="ml-2 text-[10px] font-semibold text-slate-400">thespotjobfinder.com/search</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="h-4 w-3/4 rounded bg-purple-100" />
                    <div className="flex gap-2">
                      <div className="h-7 flex-1 rounded-full bg-[#ede9fe] flex items-center px-3 text-[10px] font-bold text-[#6355d8]">
                        🔍 React Developer Fresher · Ahmedabad
                      </div>
                      <div className="h-7 px-3 rounded-full bg-[#6355d8] text-white flex items-center text-[10px] font-bold">
                        Filter
                      </div>
                    </div>
                    <div className="rounded-lg border border-purple-100 p-2 text-[10px] space-y-1">
                      <div className="font-bold text-[#1e1b4b]">Junior Frontend Engineer (Fresher)</div>
                      <div className="text-slate-400">Tech Innovators · Ahmedabad, Gujarat</div>
                      <div className="flex gap-1 pt-1">
                        <span className="badge bg-green-50 text-green-700 text-[9px]">Verified</span>
                        <span className="badge bg-purple-50 text-[#6355d8] text-[9px]">HR: hr@example.com</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>

        {/* ==============================================================
            SECTION 6: TESTIMONIALS (Card Hover Lift & Smooth Transitions)
            ============================================================== */}
        <FadeInSection id="reviews" className="space-y-8">
          <h2 className="font-heading text-center text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold text-[#1e1b4b]">
            What our <span className="font-serif italic font-normal text-[#6355d8]">job seekers say</span>
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl bg-white p-6 shadow-sm border border-purple-100/70 space-y-3 card-hover-lift"
              >
                <div className="flex items-center gap-3">
                  <img src={t.avatar} alt={t.name} className="h-10 w-10 rounded-full object-cover ring-2 ring-purple-100" />
                  <div>
                    <h3 className="text-xs font-bold text-[#1e1b4b]">{t.name}</h3>
                    <div className="text-[10px] text-slate-400">{t.role}</div>
                  </div>
                </div>
                <div className="flex text-amber-400 text-xs">★★★★★</div>
                <p className="font-serif italic text-sm text-slate-600 leading-relaxed">
                  “{t.text}”
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-1.5 pt-2">
            <span className="h-2 w-2 rounded-full bg-[#6355d8]" />
            <span className="h-2 w-2 rounded-full bg-purple-200" />
            <span className="h-2 w-2 rounded-full bg-purple-200" />
          </div>
        </FadeInSection>

        {/* ==============================================================
            SECTION 7: PURPLE CTA BANNER (Pulse Glow & Micro Interactions)
            ============================================================== */}
        <FadeInSection className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#6355d8] via-[#7565eb] to-[#8b5cf6] p-8 sm:p-12 text-white shadow-xl shadow-purple-600/15">
          {/* Subtle star / doodle illustrations */}
          <div className="pointer-events-none absolute left-10 top-6 text-white/20 text-2xl animate-spin" style={{ animationDuration: '12s' }}>✦</div>
          <div className="pointer-events-none absolute right-1/3 top-10 text-white/20 text-xl">★</div>
          <div className="pointer-events-none absolute left-1/2 bottom-6 text-white/20 text-lg">✦</div>

          <div className="grid gap-8 lg:grid-cols-12 items-center relative z-10">
            <div className="lg:col-span-8 space-y-4">
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl xl:text-[3.25rem] font-extrabold text-white leading-[1.15]">
                Start your job search journey <span className="font-serif italic font-normal">today</span>
              </h2>
              <p className="text-sm text-purple-100 max-w-lg leading-relaxed">
                Join thousands of candidates discovering real career opportunities without spam agencies or expired listings.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleAction}
                  className="rounded-full bg-white px-6 py-2.5 text-xs font-bold text-[#6355d8] shadow-md hover:bg-slate-50 transition card-hover-lift"
                >
                  Sign up for free →
                </button>
                <button
                  type="button"
                  onClick={handleAction}
                  className="rounded-full border border-white/50 px-5 py-2.5 text-xs font-semibold text-white hover:bg-white/10 transition card-hover-lift"
                >
                  Explore jobs →
                </button>
              </div>
            </div>

            {/* Right Student Image */}
            <div className="hidden lg:flex lg:col-span-4 justify-end">
              <div className="relative -mb-16 -mr-4 w-72 transition-transform duration-500 hover:scale-105">
                <img
                  src="/landing-student.jpg"
                  alt="Happy student ready for career"
                  className="w-full h-auto object-contain drop-shadow-2xl"
                />
              </div>
            </div>
          </div>
        </FadeInSection>
      </main>

      {/* Footer */}
      <FadeInSection as="footer" className="mt-20 border-t border-[#f0eaff] bg-white pt-16 pb-10">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 pb-12 border-b border-purple-50">
            {/* Col 1: Brand Info */}
            <div className="sm:col-span-2 space-y-4">
              <Link
                to="/landing"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center transition hover:opacity-90"
              >
                <img
                  src="/final_logo_updated.png"
                  alt="TheSpot JobFinder"
                  className="h-11 sm:h-12 md:h-14 w-auto object-contain"
                />
              </Link>
              <p className="max-w-sm text-xs text-slate-500 leading-relaxed">
                Empowering freshers and experienced professionals across India with verified career opportunities and direct HR access. Zero agency fees, 100% genuine postings.
              </p>
            </div>

            {/* Col 2: Navigation */}
            <div className="space-y-3">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-[#1e1b4b]">
                Navigation
              </h3>
              <ul className="space-y-2 text-xs text-slate-500">
                <li><a href="#home" className="hover:text-[#6355d8] transition">Home</a></li>
                <li><a href="#categories" className="hover:text-[#6355d8] transition">Categories</a></li>
                <li><a href="#about" className="hover:text-[#6355d8] transition">About Us</a></li>
                <li><a href="#how-it-works" className="hover:text-[#6355d8] transition">How It Works</a></li>
                <li><a href="#reviews" className="hover:text-[#6355d8] transition">Testimonials</a></li>
              </ul>
            </div>

            {/* Col 3: Popular Roles */}
            <div className="space-y-3">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-[#1e1b4b]">
                Top Categories
              </h3>
              <ul className="space-y-2 text-xs text-slate-500">
                <li><span onClick={handleAction} className="cursor-pointer hover:text-[#6355d8] transition">Software Development</span></li>
                <li><span onClick={handleAction} className="cursor-pointer hover:text-[#6355d8] transition">UI / UX Design</span></li>
                <li><span onClick={handleAction} className="cursor-pointer hover:text-[#6355d8] transition">Accounts &amp; Tally</span></li>
                <li><span onClick={handleAction} className="cursor-pointer hover:text-[#6355d8] transition">Sales &amp; Marketing</span></li>
                <li><span onClick={handleAction} className="cursor-pointer hover:text-[#6355d8] transition">Fresher Walk-ins</span></li>
              </ul>
            </div>

            {/* Col 4: Platform */}
            <div className="space-y-3">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-[#1e1b4b]">
                Platform
              </h3>
              <ul className="space-y-2 text-xs text-slate-500">
                <li><Link to="/login" className="hover:text-[#6355d8] transition">Candidate Login</Link></li>
                <li><Link to="/login" className="hover:text-[#6355d8] transition">Find Jobs</Link></li>
                <li><span className="text-slate-400">Ahmedabad, Gujarat</span></li>
                <li><span className="text-slate-400">All India Coverage</span></li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar: Copyright & Tech Creature Solution Credit */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              © {new Date().getFullYear()} TheSpot JobFinder. All rights reserved.
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <span>Designed by</span>
              <span className="font-heading font-semibold text-[#6355d8] tracking-tight hover:underline cursor-pointer">
                Tech Creature Solution
              </span>
            </div>
          </div>
        </div>
      </FadeInSection>
    </div>
  );
}
