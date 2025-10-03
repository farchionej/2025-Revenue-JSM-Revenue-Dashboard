# Payment Status Fix - Database Migration Instructions

## Problem
Payment status changes are affecting multiple months instead of just the selected month.

## Solution
Add `amount` column to `monthly_payments` table and ensure unique constraint.

---

## Step 1: Add Amount Column in Supabase

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Paste this SQL:

```sql
-- Add amount column to monthly_payments table
ALTER TABLE monthly_payments
ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2);

-- Add unique constraint to prevent duplicate client-month records
ALTER TABLE monthly_payments
ADD CONSTRAINT monthly_payments_client_month_unique
UNIQUE (client_id, month);
```

6. Click **Run** (or press Cmd/Ctrl + Enter)

---

## Step 2: Backfill Amount Data

After adding the column, run this in your browser console (on your dashboard page):

```javascript
Dashboard.actions.migratePaymentsSchema()
```

This will:
- Fetch all payment records
- Copy the amount from each client's current amount to their payment records
- Update all records in the database

---

## Step 3: Clean Up Duplicates

Run this in your browser console:

```javascript
Dashboard.actions.cleanupDuplicatePayments()
```

This will:
- Find any duplicate payment records for the same client-month combination
- Keep the most recent one
- Delete the duplicates

---

## Step 4: Test

1. Switch to September in the dashboard
2. Mark a client's payment as "Paid"
3. Switch to October
4. Verify that October's payment is still "Unpaid" (not affected)
5. Switch back to September
6. Verify September is still "Paid"

---

## What This Fixes

Before:
- Payment records didn't store their own amounts
- Possible duplicate records for same client-month
- Updating one month could affect others

After:
- Each payment record has its own amount
- Unique constraint prevents duplicates
- Each month is completely independent
