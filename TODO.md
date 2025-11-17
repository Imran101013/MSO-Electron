# TODO: Fix Monthly Loan Trends Graph and Switch to Bar Charts

## Tasks to Complete

- [x] Import BarChart and Bar from recharts in Dashboard.tsx
- [x] Create useMemo hook to aggregate budget contributions by month-year from meetings
- [x] Create useMemo hook to aggregate loan issued amounts by month-year from members.loans (using loan.date)
- [x] Create useMemo hook to aggregate loan collected amounts by month-year from meetings.loanCollections (using meeting.date)
- [x] Update Budget Trend graph to use BarChart with aggregated monthly data, using Bar components with appropriate colors
- [x] Update Loans Trend graph to use BarChart with aggregated monthly issued and collected data, using Bar components with colors matching original lines
- [x] Ensure data is sorted by month for proper display in both graphs
- [x] Test the dashboard to verify graphs display correctly with monthly data and bar charts
- [x] Verify that loan transactions are properly aggregated and shown in the loans trend graph
