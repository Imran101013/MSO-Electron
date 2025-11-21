# TODO: Fix Total Outstanding in Loan Management

- [ ] Update `totalOutstanding` calculation in `src/pages/Loans.tsx` to sum `loan.remaining` instead of `loan.amountWithInterest` for active loans, ensuring the outstanding amount decreases with each installment payment.
