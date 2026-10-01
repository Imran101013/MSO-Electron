export const ORGANIZATION_CONFIG = {
  // Finance settings
  LOAN_INTEREST_RATE: 10, // Loan interest rate in percentage
  // Taken from a member's dividend for each meeting of the year they were marked absent at.
  ABSENCE_PENALTY_PER_MEETING: 50,
  // Share of each year's profit (bank profit + loan interest + penalties + absence charges)
  // credited to the reserve fund at the AGM; members share the rest.
  RESERVE_PERCENT_OF_PROFIT: 30,
  // The bank takes a charge on a cheque withdrawal above this amount (loans, reserve expenses).
  BANK_CHARGE_THRESHOLD: 50000,

  // Pagination settings
  MEMBERS_PER_PAGE: 5,

  // Remind the admin to back up once the last backup is this many days old (0 = never).
  BACKUP_REMINDER_DAYS: 7,

  // Validation rules (fixed; not user settings)
  MINIMUM_NAME_LENGTH: 2,

  // Phone number validation patterns
  PHONE_PATTERNS: {
    // With country code: +923001234567 (13 characters: +92 + 11 digits)
    WITH_COUNTRY_CODE: /^\+92\d{11}$/,
    // Without country code: 03001234567 (11 characters: 0 + 10 digits)
    WITHOUT_COUNTRY_CODE: /^0\d{10}$/,
    // Both formats
    ALL: /^(\+92|0)\d{10,11}$/,
  },

  // Default date formats
  DATE_FORMAT: "dd/MM/yyyy",

  // Default currency
  CURRENCY: "PKR",

  // UI defaults
  THEME: "system",
  TIME_FORMAT: "12",
  ITEMS_PER_PAGE: 10,
  ENABLE_ANIMATIONS: true,
  LANGUAGE: "en",

  // Status values
  LOAN_STATUS: {
    ACTIVE: "Active",
    PAID: "Paid",
    DEFAULTED: "Defaulted",
  } as const,

  // Loans run for a fixed period and may be repaid in monthly instalments or as a lump sum
  // at any point within it.
  LOAN_PERIOD_MONTHS: 12,
  // Charged for each full month a loan is still unpaid after its period ends (see utils/loanPenalty.ts).
  LATE_PENALTY_PER_MONTH: 500,
} as const;

export type LoanStatus =
  (typeof ORGANIZATION_CONFIG.LOAN_STATUS)[keyof typeof ORGANIZATION_CONFIG.LOAN_STATUS];
