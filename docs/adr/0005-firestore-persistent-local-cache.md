# Firestore persistent local cache with multi-tab support

Client hooks (`useRooms`, `useBillingRecords`, and the other business-data hooks) subscribe with `onSnapshot()` for each component mount. Without a local cache, navigating back to a page or refreshing it re-reads the collection from the server. The Firestore client is now created with `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`, so snapshots persist in IndexedDB across reloads and tabs.

The multi-tab manager is used because users may unintentionally open the app in more than one tab. Default single-tab persistence can silently fall back to an in-memory cache for additional tabs, losing the persistence benefit without reporting an error.

## Considered Options

- **Persistent local cache with multi-tab support (chosen)** — reduces repeat server reads after navigation and reload while preserving live `onSnapshot()` updates in all open tabs.
- **Lift subscriptions into a top-level provider** — rejected because it reverses the documented no-app-wide-Context-for-business-data state strategy, and it would not retain data across a full refresh.
- **Default single-tab persistence** — rejected because additional tabs can silently fall back to memory-only caching.
