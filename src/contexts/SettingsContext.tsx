import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { ORGANIZATION_CONFIG } from "@/config/organization";

export interface Settings {
  loanInterestRate: number;
  applyLoanInterest: boolean;
  membersPerPage: number;
  minimumNameLength: number;
  minimumPhoneLength: number;
  minimumAddressLength: number;
  dateFormat: string;
  currency: string;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

const STORAGE_KEY = "hc_settings_v1";

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Settings;
    } catch (e) {
      // ignore parse errors
    }
    return {
      loanInterestRate: ORGANIZATION_CONFIG.LOAN_INTEREST_RATE,
      applyLoanInterest: true,
      membersPerPage: ORGANIZATION_CONFIG.MEMBERS_PER_PAGE,
      minimumNameLength: ORGANIZATION_CONFIG.MINIMUM_NAME_LENGTH,
      minimumPhoneLength: ORGANIZATION_CONFIG.MINIMUM_PHONE_LENGTH,
      minimumAddressLength: ORGANIZATION_CONFIG.MINIMUM_ADDRESS_LENGTH,
      dateFormat: ORGANIZATION_CONFIG.DATE_FORMAT,
      currency: ORGANIZATION_CONFIG.CURRENCY,
    };
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
