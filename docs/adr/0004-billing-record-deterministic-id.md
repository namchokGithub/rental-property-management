# Billing record IDs are deterministic, not random

Billing creation checked for an existing record (`propertyId + roomId + billingMonth`) via a query inside a Firestore transaction, then wrote to a random auto-generated document ID. Firestore's transaction guarantee only covers documents actually *read*; it does not protect a query's empty result against another concurrent transaction inserting a matching document, and since the write target was a fresh random ID every time, two simultaneous requests for the same room+month had no document in common to force them to serialize — both could pass the empty-check and both commit, producing duplicate billing records. `billingRecords` document IDs are now deterministic: `` `${roomId}_${billingMonth}` ``. Two concurrent creates now target the same document; Firestore's transaction retry on that shared document causes the loser to re-run, see the now-committed record, and correctly fail with `BILLING_ALREADY_EXISTS`.

## Considered Options

- **Deterministic primary document ID (chosen)** — one collection, no new moving parts. Billing IDs become predictable, which is harmless: access is gated by the property-ownership check, not by ID secrecy.
- **Separate lock document** (`billingLocks/{roomId}_{billingMonth}`) written transactionally alongside a still-random `billingRecords` ID — keeps every collection on the same random-ID convention, at the cost of one extra collection purely to hold a uniqueness constraint. Rejected as unneeded complexity for this dataset size.
