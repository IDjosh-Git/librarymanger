# Library Manager v5.60 — atomic Review approval leases

Adds an atomic, five-minute cloud approval lease for shared Review records. Before an administrator approves a pending book, the browser calls a Supabase SECURITY DEFINER RPC to claim that record. A concurrent approval attempt from another administrator is refused; the lease is released after the attempt and abandoned leases expire after five minutes. If the migration or connection is missing, approval fails closed rather than bypassing the lock.

## Deployment
1. Run `database/14_review_approval_leases.sql` in Supabase SQL Editor after earlier migrations 02 and 12.
2. Deploy the updated application to Vercel.
3. Test simultaneous approvals of the same Review record from two administrator accounts, including a failed save and a stale record.

## Scope and limitations
This is **approval-only coordination**, not an editing lock or automatic Review assignment. Older deployed clients that do not call the RPC can still bypass the advisory lease; deploy the new client to all users. The lease does not make Inventory insertion and Review resolution a single database transaction; a separate transactional approval workflow is still recommended. No live deployment or database migration has been performed.
