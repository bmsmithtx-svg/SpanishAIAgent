"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: "D" },
  { href: "/library", label: "Library", icon: "L" },
  { href: "/learn", label: "Learn", icon: "R" },
  { href: "/practice", label: "Practice", icon: "P" },
  { href: "/chat", label: "Tutor Chat", icon: "C" },
  { href: "/settings", label: "Settings", icon: "S" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname === "/";

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            SA
          </div>
          <div>
            <p className="brand-title">SpanishAIAgent</p>
            {!isDashboard ? <p className="brand-subtitle">PDF-grounded study</p> : null}
          </div>
        </div>

        <nav>
          <ul className="nav-list">
            {navItems.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link className={`nav-link${isActive ? " active" : ""}`} href={item.href}>
                    <span className="nav-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {!isDashboard ? (
          <div className="sidebar-note">
            <strong>Source rule</strong>
            <p>
              Future lessons and tutor answers must be grounded only in uploaded PDFs with
              file and page citations.
            </p>
          </div>
        ) : null}
      </aside>

      <div className="content-area">
        <header className="topbar">
          <p className="topbar-title">SpanishAIAgent</p>
          {!isDashboard ? <span className="topbar-pill">PDF-only mode</span> : null}
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
