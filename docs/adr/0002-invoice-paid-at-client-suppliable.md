# Invoice paidAt stays client-suppliable, not server-only

Marking an invoice paid accepts an optional `paidAt` from the request body instead of always stamping the server's current time. Real-world rent collection is often recorded after the fact (cash collected days earlier, entered into the system later), so a server-only timestamp would force staff to falsify "today" as the payment date. The endpoint is admin-only, and the service rejects any `paidAt` earlier than the invoice's `issuedAt`; omitting it still defaults to `serverTimestamp()`.

## Considered Options

- **Client-suppliable, validated against issuedAt (chosen)** — matches real payment-recording workflows, tamper surface bounded by admin-only access + the issuedAt floor.
- **Server timestamp only** — fully tamper-proof and simpler, but loses the ability to record a payment's true date, which this domain needs.
