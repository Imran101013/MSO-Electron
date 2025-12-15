# Profit Distribution Implementation TODO

## Step 1: Update OrganizationContext.tsx

- [x] Add interfaces for profit distribution records (ProfitDistribution, ProfitAllocation)
- [x] Add state for profit distributions history
- [x] Add function to calculate budget ratios from latest meeting
- [x] Add function to distribute profit (10% to reserve, rest based on ratios)
- [x] Update reserve transactions when allocating to reserve
- [x] Update member budgets when distributing to members

## Step 2: Create ProfitDistribution.tsx page

- [x] Create new component with form to input profit amount
- [x] Add calculation display (10% reserve, distribution ratios)
- [x] Add preview of allocations before confirming
- [x] Add button to execute distribution
- [x] Use shadcn/ui components for consistent design

## Step 3: Update routing

- [x] Find routing file (likely App.tsx)
- [x] Add route for /profit-distribution
- [x] Import and use ProfitDistribution component

## Step 4: Testing and Integration

- [x] Test profit distribution calculations
- [x] Test UI integration and responsiveness
- [x] Add error handling and validation
- [x] Ensure consistent styling with existing pages
