import { useEffect } from "react";
import { useSettings } from "@/contexts/SettingsContext";

export default function ThemeApplier() {
  const { settings } = useSettings();

  useEffect(() => {
    const root = document.documentElement;

    // Theme: 'system' | 'light' | 'dark'
    const applyTheme = () => {
      let dark = false;
      if (settings.theme === "dark") dark = true;
      else if (settings.theme === "light") dark = false;
      else {
        dark =
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches;
      }

      if (dark) root.classList.add("dark");
      else root.classList.remove("dark");
      root.setAttribute("data-theme", settings.theme);
    };

    applyTheme();

    // listen for system changes when using 'system'
    let mql: MediaQueryList | null = null;
    if (settings.theme === "system" && window.matchMedia) {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme();
      if (mql) {
        if (mql.addEventListener) {
          mql.addEventListener("change", handler);
        } else {
          mql.addListener(handler);
        }

        return () => {
          if (mql.removeEventListener) {
            mql.removeEventListener("change", handler);
          } else {
            mql.removeListener(handler);
          }
        };
      }
    }
  }, [settings.theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-time-format", settings.timeFormat);
  }, [settings.timeFormat]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(
      "data-enable-animations",
      settings.enableAnimations ? "true" : "false"
    );
  }, [settings.enableAnimations]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("lang", settings.language || "en");
  }, [settings.language]);

  return null;
}
