"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/today",
    label: "Today",
    icon: (
      <path d="M6 3v4M18 3v4M4 8h16M5 21h14a1 1 0 001-1V7a1 1 0 00-1-1H5a1 1 0 00-1 1v13a1 1 0 001 1z" />
    ),
  },
  {
    href: "/history",
    label: "History",
    icon: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-5 3 3 5-7" />
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
