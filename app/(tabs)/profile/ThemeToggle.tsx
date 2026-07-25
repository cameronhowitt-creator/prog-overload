"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as Theme | null) ?? "system";
    setTheme(saved);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    if (next === "system") {
      localStorage.removeItem("theme");
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem("theme", next);
      document.documentElement.setAttribute("data-theme", next);
    }
  }

  const options: { key: Theme; label: string }[] = [
    { key: "system", label: "System" },
    { key: "light", label: "Light" },
    { key: "dark", label: "Dark" },
  ];

  return (
    <div className="field">
      <label>Appearance</label>
      <div className="chip-grid">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`chip${theme === o.key ? " selected" : ""}`}
            style={{ width: "calc(33.333% - 7px)", justifyContent: "center" }}
            onClick={() => apply(o.key)}
          >
            <div className="txt">
              <div className="n">{o.label}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
