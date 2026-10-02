import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { ORGANIZATION_CONFIG } from "@/config/organization";
import { DEFAULT_CIRCULAR } from "@/lib/circular";

export interface Settings {
  loanInterestRate: number;
  applyLoanInterest: boolean;
  /** Penalty per full month late, recorded on each loan when it is issued. */
  latePenaltyPerMonth: number;
  /** Taken from a member's dividend for each meeting of the year they missed; part of the year's profit. */
  absencePenaltyPerMeeting: number;
  /** Share (%) of the year's profit credited to the reserve fund at the AGM; members share the rest.
   *  (A new key: the old reserveSharePercent held a 10% share of bank profit only.) */
  reservePercent: number;
  /** A cheque withdrawal above this amount carries a bank charge: on a loan the member pays it with
   *  the loan, on a reserve expense the reserve fund pays it. */
  bankChargeThreshold: number;
  /** Rows per page on the Members list. */
  membersPerPage: number;
  /** Rows per page on every other table (components/TablePager.tsx) and the Audit Log. */
  itemsPerPage: number;
  /** Days after the last backup before a reminder shows (0 = never remind), when the trigger is "age". */
  backupReminderDays: number;
  /** What brings up the backup reminder: the last backup's age (backupReminderDays), a meeting
   *  saved after it, or any change to the records after it (lib/backup.ts). */
  backupReminderTrigger: "age" | "meeting" | "change";
  /** The meeting circular sent to the WhatsApp group; fields in braces are filled from the
   *  scheduled meeting (lib/circular.ts). */
  circularTemplate: string;
  dateFormat: string;
  currency: string;
  theme: "system" | "light" | "dark";
  timeFormat: "12" | "24";
  enableAnimations: boolean;
  /** Not exposed: there are no translations; sets the document language only. */
  language: string;
  /** Not exposed: the organisation name is fixed; "MSO" resolves to the full name on documents. */
  organizationName: string;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

const STORAGE_KEY = "hc_settings_v1";

export const DEFAULT_SETTINGS: Settings = {
  loanInterestRate: ORGANIZATION_CONFIG.LOAN_INTEREST_RATE,
  applyLoanInterest: true,
  latePenaltyPerMonth: ORGANIZATION_CONFIG.LATE_PENALTY_PER_MONTH,
  absencePenaltyPerMeeting: ORGANIZATION_CONFIG.ABSENCE_PENALTY_PER_MEETING,
  reservePercent: ORGANIZATION_CONFIG.RESERVE_PERCENT_OF_PROFIT,
  bankChargeThreshold: ORGANIZATION_CONFIG.BANK_CHARGE_THRESHOLD,
  membersPerPage: ORGANIZATION_CONFIG.MEMBERS_PER_PAGE,
  itemsPerPage: ORGANIZATION_CONFIG.ITEMS_PER_PAGE || 10,
  backupReminderDays: ORGANIZATION_CONFIG.BACKUP_REMINDER_DAYS,
  backupReminderTrigger: "age",
  circularTemplate: DEFAULT_CIRCULAR,
  dateFormat: ORGANIZATION_CONFIG.DATE_FORMAT,
  currency: ORGANIZATION_CONFIG.CURRENCY,
  theme: ORGANIZATION_CONFIG.THEME || "system",
  timeFormat: ORGANIZATION_CONFIG.TIME_FORMAT || "12",
  enableAnimations: ORGANIZATION_CONFIG.ENABLE_ANIMATIONS ?? true,
  language: ORGANIZATION_CONFIG.LANGUAGE || "en",
  organizationName: "MSO",
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const defaults = DEFAULT_SETTINGS;
    try {
      // Merged over the defaults so settings added in later versions get a value.
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<Settings>) };
    } catch (e) {
      // ignore parse errors
    }
    return defaults;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      // ignore
    }
  }, [settings]);

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

export default SettingsProvider;
