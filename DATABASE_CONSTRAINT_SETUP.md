# Database Constraint Setup for Payment Status Fix

## Problem

Payment status updates in one month were potentially affecting future months due to duplicate payment records in the database.

## Root Cause

The `monthly_payments` table was missing a UNIQUE constraint on the combination of `(client_id, month)`, allowing multiple payment records to exist for the same client in the same month.

## Solution

Add a UNIQUE constraint to prevent duplicate records at the database level.

---

## Step 1: Run Duplicate Detection (Required First!)

Before adding the constraint, you **MUST** clean up any existing duplicates:

1. Open your dashboard at: https://2025-revenue-jsm-revenue-dashboard.vercel.app/
2. Open Browser Console (F12 → Console tab)
3. Run:
   ```javascript
   await detectDuplicates()
   ```
4. Review the console output to see which duplicates were found and deleted
5. The function keeps the most recent record and deletes older duplicates

---

## Step 2: Add Database Constraint (Supabase Console)

### Via Supabase Dashboard (Recommended):

1. Go to https://supabase.com/dashboard
2. Select your project: **2025-Revenue-JSM-Revenue-Dashboard**
3. Navigate to: **Database** → **Tables** → `monthly_payments`
4. Click **"Indexes"** tab
5. Click **"Add Index"**
6. Configure:
   - **Index Name**: `unique_client_month`
   - **Columns**: Select `client_id` and `month`
   - **Index Type**: UNIQUE
   - Check: ☑️ **Unique**
7. Click **"Create Index"**

### Via SQL Editor (Alternative):

1. Go to **SQL Editor** in Supabase Dashboard
2. Run this SQL:
   ```sql
   ALTER TABLE monthly_payments
   ADD CONSTRAINT unique_client_month UNIQUE (client_id, month);
   ```
3. Click **"Run"**

---

## Step 3: Verify the Constraint

Run this query in SQL Editor to confirm:

```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'monthly_payments'
  AND constraint_type = 'UNIQUE';
```

You should see `unique_client_month` in the results.

---

## What This Fixes

✅ **Prevents duplicate payment records** - Database will reject any attempt to create a second payment record for the same client/month

✅ **Ensures data integrity** - Each client can only have ONE payment record per month

✅ **Fixes the propagation issue** - Updating August will only affect August, because there's only one record to update

---

## Testing After Setup

1. Try to manually insert a duplicate (should fail):
   ```sql
   -- This should return an error about unique constraint violation
   INSERT INTO monthly_payments (client_id, month, amount, status)
   VALUES (1, '2025-08', 500, 'unpaid');

   INSERT INTO monthly_payments (client_id, month, amount, status)
   VALUES (1, '2025-08', 500, 'unpaid'); -- This should FAIL
   ```

2. Test updating a payment in August:
   - Switch to August in the dashboard
   - Mark a payment as "paid"
   - Switch to September
   - Verify September payment is still "unpaid"

---

## Maintenance Functions (Available in Console)

After deploying these changes, you have access to these console functions:

### `detectDuplicates()`
Scans for and removes duplicate payment records. Run this periodically if you suspect issues.

```javascript
await detectDuplicates()
```

### `forceRefresh()`
Clears all caches and reloads data from database. Use if you see stale data.

```javascript
forceRefresh()
```

### `populateFutureMonths()`
Creates payment records for the next 13 months. Use when setting up new months.

```javascript
await populateFutureMonths()
```

---

## Additional Improvements Made

1. **Duplicate Detection Function** - Automatically finds and cleans up duplicate records
2. **Improved `createPaymentsForMonth()`** - Now checks for existing records per-client before creating
3. **Enhanced Logging** - `togglePaymentStatus()` now logs which records are being updated
4. **Force Refresh** - Clear all caches and reload data with one command

---

## If Issues Persist

If you still see payment status propagating to future months after implementing this fix:

1. Run `detectDuplicates()` in console to check for any remaining duplicates
2. Check console logs when updating a payment - look for:
   - "🚨 CRITICAL: X records were updated!" (should only update 1)
   - Any warnings about multiple records
3. Verify the constraint exists in the database (Step 3 above)
4. Check if there are any database triggers affecting `monthly_payments` table

---

## Questions?

Contact support with:
- Console logs from the update operation
- Results from running `detectDuplicates()`
- Specific example of which client/month is affected
