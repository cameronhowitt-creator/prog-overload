"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Log sits LEFT of Today: it's where you correct what you just entered, so it
// reads as "what happened" -> "what's now" -> "what's next".
const TABS = [
  {
    href: "/log",
    label: "Log",
    icon: (
      <>
        <path d="M9 11l2 2 4-4" />
        <path d="M5 21h14a1 1 0 001-1V4a1 1 0 00-1-1H5a1 1 0 00-1 1v16a1 1 0 001 1z" />
      </>
    ),
  },
  {
    href: "/today",
    label: "Today",
    icon: (
      <path d="M6 3v4M18 3v4M4 8h16M5 21h14a1 1 0 001-1V7a1 1 0 00-1-1H5a1 1 0 00-1 1v13a1 1 0 001 1z" />
    ),
  },
  {
    href: "/plan",
    label: "Plan",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 10h18M8 2v4M16 2v4" />
        <path d="M8 15h.01M12 15h.01M16 15h.01" />
      </>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </>
    ),
  },
];

export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link key={t.href} href={t.href} className={active ? "active" : ""}>
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {t.icon}
            </svg>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
