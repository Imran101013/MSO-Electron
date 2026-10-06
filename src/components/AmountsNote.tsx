import { useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";

/**
 * "Amounts in PKR" for a section's header, so the figures under it are shown without the currency.
 * `currency` overrides the saved setting (e.g. one being edited on the Settings page).
 */
export default function AmountsNote({ currency, className }: { currency?: string; className?: string }) {
  const { settings } = useSettings();
  return (
    <span
      className={cn(
        "text-xs font-semibold text-black px-3 py-1 bg-accent/30 whitespace-nowrap",
        className,
      )}
    >
      Amounts in {currency || settings.currency}
    </span>
  );
}
