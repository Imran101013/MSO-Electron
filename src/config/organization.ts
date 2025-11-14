export const ORGANIZATION_CONFIG = {
  // Finance settings
  LOAN_INTEREST_RATE: 10, // Loan interest rate in percentage

  // Pagination settings
  MEMBERS_PER_PAGE: 5,

  // Validation rules
  MINIMUM_NAME_LENGTH: 2,
  MINIMUM_PHONE_LENGTH: 10,
  MINIMUM_ADDRESS_LENGTH: 5,

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

  // Status values
  LOAN_STATUS: {
    ACTIVE: "Active",
    PAID: "Paid",
  } as const,
} as const;

export type LoanStatus =
  (typeof ORGANIZATION_CONFIG.LOAN_STATUS)[keyof typeof ORGANIZATION_CONFIG.LOAN_STATUS];
