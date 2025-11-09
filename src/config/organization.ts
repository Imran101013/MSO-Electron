export const ORGANIZATION_CONFIG = {
  // Finance settings
  LOAN_INTEREST_RATE: 10, // Loan interest rate in percentage

  // Pagination settings
  MEMBERS_PER_PAGE: 5,

  // Validation rules
  MINIMUM_NAME_LENGTH: 2,
  MINIMUM_PHONE_LENGTH: 10,
  MINIMUM_ADDRESS_LENGTH: 5,

  // Default date formats
  DATE_FORMAT: "MM dd, yyyy",
  SHORT_DATE_FORMAT: "MM dd, yyyy",

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
