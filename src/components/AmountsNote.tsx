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
        "inline-flex w-fit items-center whitespace-nowrap rounded-sm border border-primary/20 bg-ledger-wash px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary",
        className,
      )}
    >
      Amounts in {currency || settings.currency}
    </span>
  );
}
