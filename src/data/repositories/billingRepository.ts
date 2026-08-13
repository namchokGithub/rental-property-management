import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
  type Transaction,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { calculateMeterReading, calculateBillingTotals } from "@/lib/calculations";
import { generateInvoiceNumber } from "@/lib/invoice";
import { isoToTimestamp, timestampToIso } from "@/data/repositories/converters/timestamp";
import type {
  BillingCharge,
  BillingRecord,
  BillingStatus,
  CreateBillingInput,
  InvoiceSnapshot,
  MeterReading,
  UpdateBillingInput,
} from "@/types/billing";

export class BillingAlreadyExistsError extends Error {
  constructor() {
    super("A bill for this room and month already exists");
    this.name = "BillingAlreadyExistsError";
  }
}

// Firestore rejects writes containing an `undefined` field value (the client
// is initialized without `ignoreUndefinedProperties`). Optional input fields
// are commonly built as `value || undefined` by the forms, so every write
// needs this first. `billingRepository.ts` needs bespoke transactions, so it
// doesn't build on `firestoreCrud.ts`'s factory — this is the same 2-line
// utility duplicated locally rather than exporting that file's private
// helper just to save a few lines (YAGNI).
function stripUndefined(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function billingDocId(roomId: string, billingMonth: string): string {
  return `${roomId}_${billingMonth}`;
}

function billingCollectionRef(propertyId: string) {
  return collection(db, "properties", propertyId, "billing");
}

function billingRef(propertyId: string, roomId: string, billingMonth: string) {
  return doc(billingCollectionRef(propertyId), billingDocId(roomId, billingMonth));
}

function toBillingRecord(id: string, data: Record<string, unknown>): BillingRecord {
  return {
    id,
    ...data,
    issuedAt: timestampToIso(data.issuedAt as Timestamp | null | undefined),
    dueDate: timestampToIso(data.dueDate as Timestamp | null | undefined),
    paidAt: timestampToIso(data.paidAt as Timestamp | null | undefined),
    deletedAt: timestampToIso(data.deletedAt as Timestamp | null | undefined) ?? null,
    createdAt: timestampToIso(data.createdAt as Timestamp | null | undefined) ?? new Date().toISOString(),
    updatedAt: timestampToIso(data.updatedAt as Timestamp | null | undefined) ?? new Date().toISOString(),
  } as BillingRecord;
}

// Soft-deleted docs (`deletedAt` set) are filtered out client-side, not via a
// Firestore `where("deletedAt", "==", null)` query — see the identical
// comment in `firestoreCrud.ts` for why (missing-field `==` semantics + no
// backfill mechanism). `nextInvoiceNumber()` deliberately does NOT use this —
// a soft-deleted bill's invoice number must still count so it's never
// reissued to a different bill.
function isNotDeleted(data: Record<string, unknown>): boolean {
  return !data.deletedAt;
}

// Every form submission sends `otherCharges` without ids (`Omit<BillingCharge,
// "id">[]`) since `BillingFormDialog` never round-trips the master-charge ids
// as `BillingCharge.id` — mirrors the pre-Firestore repository's
// `buildCharges()`, which also assigned a fresh id on every write.
function withChargeIds(charges: Omit<BillingCharge, "id">[]): BillingCharge[] {
  return charges.map((c) => ({ ...c, id: crypto.randomUUID() }));
}

/**
 * Assigns the next sequence number for `billingMonth`, reading the freshest
 * server state from inside the caller's transaction. Same logic
 * `generateInvoiceNumber()` always ran (untouched, reused as-is) — the only
 * change is *where* "existing records for this month" comes from.
 *
 * Adaptation from the naive "just query inside the transaction" idea: the
 * web client SDK's `Transaction.get()` only accepts a `DocumentReference` —
 * there's no `transaction.get(query)` overload (same missing-overload
 * constraint `assignmentRepository.ts` documents) — so the month's sibling
 * docs are first discovered via a plain `getDocs()` query, exactly like
 * `assignmentRepository.endByRoomId()` does for its active-assignment
 * lookup. The part that actually matters for correctness: every sibling
 * found is then re-read via `transaction.get(ref)`, pulling it into this
 * transaction's tracked read-set. Two concurrent issuances for the same
 * property+month each end up transactionally reading every *other* bill in
 * that month (including each other's target doc) — so whichever commits
 * first bumps a version the other already read, and Firestore aborts and
 * retries the loser, which then re-executes this whole function, re-reads,
 * and sees the winner's already-committed `invoiceNumber`. Without this
 * re-read step, two different documents being issued concurrently would each
 * only be tracked via their own `ref` and Firestore would never detect the
 * conflict, silently allowing duplicate invoice numbers.
 *
 */
async function nextInvoiceNumber(
  transaction: Transaction,
  propertyId: string,
  billingMonth: string,
): Promise<string> {
  const monthQuery = await getDocs(query(billingCollectionRef(propertyId), where("billingMonth", "==", billingMonth)));
  const siblingSnapshots = await Promise.all(monthQuery.docs.map((d) => transaction.get(d.ref)));
  const existingForMonth = siblingSnapshots.flatMap((snapshot) => {
    if (!snapshot.exists()) return [];
    const data = snapshot.data() as RawBillingDoc;
    return [
      ...(data.invoiceNumber ? [{ invoiceNumber: data.invoiceNumber }] : []),
      ...(data.invoices ?? []).map((invoice) => ({ invoiceNumber: invoice.invoiceNumber })),
    ];
  }) as BillingRecord[];
  return generateInvoiceNumber(billingMonth, existingForMonth);
}

// Raw Firestore data as read inside a transaction: date fields are
// Timestamps here, not the ISO strings `BillingRecord` declares. Fine for
// this module's own use below (only ever round-tripped Timestamp-to-Timestamp,
// or read as plain strings/numbers) but this shape must never be cast to
// `BillingRecord` and handed to a caller — that mistake is exactly Task 3's
// Important finding.
interface RawBillingDoc {
  roomId: string;
  tenantId?: string;
  status: BillingStatus;
  billingMonth: string;
  invoiceNumber: string | null;
  electricity: MeterReading;
  water: MeterReading;
  otherCharges: BillingCharge[];
  rentAmount: number;
  subtotal: number;
  total: number;
  dueDate: Timestamp | null;
  issuedAt: Timestamp | null;
  paidAt: Timestamp | null;
  invoices?: InvoiceSnapshot[];
}

function invoiceSnapshot(
  record: RawBillingDoc,
  invoiceNumber: string,
  status: InvoiceSnapshot["status"],
  issuedAt: string,
): InvoiceSnapshot {
  return {
    id: crypto.randomUUID(),
    invoiceNumber,
    status,
    issuedAt,
    roomId: record.roomId,
    ...(record.tenantId ? { tenantId: record.tenantId } : {}),
    billingMonth: record.billingMonth,
    electricity: record.electricity,
    water: record.water,
    rentAmount: record.rentAmount,
    otherCharges: record.otherCharges,
    subtotal: record.subtotal,
    total: record.total,
    ...(record.dueDate ? { dueDate: timestampToIso(record.dueDate) } : {}),
  };
}

function invoiceHistory(record: RawBillingDoc, legacyInvoiceId: string = crypto.randomUUID()): InvoiceSnapshot[] {
  if (record.invoices?.length) return record.invoices;
  if (!record.invoiceNumber || !record.issuedAt) return [];
  return [{
    ...invoiceSnapshot(record, record.invoiceNumber, "issued", record.issuedAt.toDate().toISOString()),
    id: legacyInvoiceId,
  }];
}

export const billingRepository = {
  subscribe(propertyId: string, callback: (records: BillingRecord[]) => void): Unsubscribe {
    return onSnapshot(billingCollectionRef(propertyId), (snapshot) => {
      callback(
        snapshot.docs
          .filter((document) => isNotDeleted(document.data()))
          .map((document) => toBillingRecord(document.id, document.data())),
      );
    });
  },

  async create(propertyId: string, input: CreateBillingInput): Promise<string> {
    const id = billingDocId(input.roomId, input.billingMonth);
    const electricity = calculateMeterReading(
      input.electricityPreviousMeter,
      input.electricityCurrentMeter,
      input.electricityRate,
    );
    const water = calculateMeterReading(input.waterPreviousMeter, input.waterCurrentMeter, input.waterRate);
    const otherCharges = withChargeIds(input.otherCharges);
    const totals = calculateBillingTotals({
      electricityAmount: electricity.amount,
      waterAmount: water.amount,
      rentAmount: input.rentAmount,
      otherCharges,
    });
    // `create()` always persists `status: "draft"`, regardless of
    // `input.status` — even though the create form's status selector lets a
    // user pick "issued" for a create-and-issue-in-one-step submission.
    // `nextInvoiceNumber()` must NOT be called from here: its
    // sibling-discovery (`getDocs()` on the month, see below) can only see
    // documents that already exist, so a brand-new doc being created for the
    // first time is invisible to any OTHER concurrent create's read set.
    // Two admins submitting create-with-"issued" for two different rooms,
    // same month, with no pre-existing bills that month, would each see an
    // empty sibling set and independently compute the same
    // `INV-YYYY-MM-001` — Firestore has no conflicting read to detect
    // between them, so both would commit. `update()`'s transactional
    // sibling-pinning only actually protects this invariant once the record
    // already exists as a committed draft (i.e., by the time `update()` runs,
    // it IS visible to other transactions' sibling queries). The UI layer
    // (`BillingPage.tsx`) recovers "create and issue in one submission" by
    // calling `update()` immediately after `create()` resolves, as a
    // separate transactional call that goes through this safe path.
    await runTransaction(db, async (transaction) => {
      const ref = billingRef(propertyId, input.roomId, input.billingMonth);
      const existing = await transaction.get(ref);
      if (existing.exists()) {
        throw new BillingAlreadyExistsError();
      }
      transaction.set(ref, {
        ...stripUndefined({ tenantId: input.tenantId }),
        roomId: input.roomId,
        billingMonth: input.billingMonth,
        electricity,
        water,
        rentAmount: input.rentAmount,
        otherCharges,
        ...totals,
        // Set explicitly, overriding whatever raw string
        // `stripUndefined(input)` would otherwise have left in place — always
        // stored as a proper `Timestamp`, consistent with
        // issuedAt/paidAt/createdAt/updatedAt.
        dueDate: input.dueDate ? isoToTimestamp(input.dueDate) : null,
        status: "draft",
        invoiceNumber: null,
        invoices: [],
        issuedAt: null,
        paidAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    return id;
  },

  async update(propertyId: string, id: string, input: UpdateBillingInput): Promise<{ invoiceNumber: string | null }> {
    const ref = doc(billingCollectionRef(propertyId), id);
    return runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error("Billing record not found");
      const currentRaw = snapshot.data() as RawBillingDoc;

      const willIssueNow = input.status === "issued" && currentRaw.status !== "issued";
      const willMarkPaidNow = input.status === "paid" && currentRaw.status !== "paid";

      const invoiceNumber = willIssueNow
        ? await nextInvoiceNumber(transaction, propertyId, currentRaw.billingMonth)
        : (currentRaw.invoiceNumber ?? null);

      // `UpdateBillingInput` doubles as both a full-form edit (every meter
      // field present) and a status-only patch (`{ status: "issued" }` from
      // the table's Issue/Mark Paid actions) — only recompute a reading when
      // at least one of its three inputs was actually provided, otherwise
      // keep the record's existing reading untouched.
      const touchesElectricity =
        input.electricityPreviousMeter !== undefined ||
        input.electricityCurrentMeter !== undefined ||
        input.electricityRate !== undefined;
      const electricity = touchesElectricity
        ? calculateMeterReading(
            input.electricityPreviousMeter ?? currentRaw.electricity.previousMeter,
            input.electricityCurrentMeter ?? currentRaw.electricity.currentMeter,
            input.electricityRate ?? currentRaw.electricity.rate,
          )
        : currentRaw.electricity;

      const touchesWater =
        input.waterPreviousMeter !== undefined ||
        input.waterCurrentMeter !== undefined ||
        input.waterRate !== undefined;
      const water = touchesWater
        ? calculateMeterReading(
            input.waterPreviousMeter ?? currentRaw.water.previousMeter,
            input.waterCurrentMeter ?? currentRaw.water.currentMeter,
            input.waterRate ?? currentRaw.water.rate,
          )
        : currentRaw.water;

      const otherCharges = input.otherCharges ? withChargeIds(input.otherCharges) : currentRaw.otherCharges;
      const rentAmount = input.rentAmount ?? currentRaw.rentAmount;
      const totals = calculateBillingTotals({
        electricityAmount: electricity.amount,
        waterAmount: water.amount,
        rentAmount,
        otherCharges,
      });
      const nextRaw: RawBillingDoc = {
        ...currentRaw,
        roomId: input.roomId ?? currentRaw.roomId,
        tenantId: input.tenantId ?? currentRaw.tenantId,
        billingMonth: currentRaw.billingMonth,
        electricity,
        water,
        rentAmount,
        otherCharges,
        subtotal: totals.subtotal,
        total: totals.total,
        dueDate: input.dueDate !== undefined ? isoToTimestamp(input.dueDate) : currentRaw.dueDate,
      };
      const invoices = willIssueNow && invoiceNumber
        ? [...invoiceHistory(currentRaw), invoiceSnapshot(nextRaw, invoiceNumber, "issued", new Date().toISOString())]
        : currentRaw.invoices;

      transaction.update(ref, {
        ...stripUndefined({
          roomId: input.roomId,
          tenantId: input.tenantId,
          status: input.status,
        }),
        electricity,
        water,
        rentAmount,
        otherCharges,
        ...totals,
        invoiceNumber,
        ...(invoices ? { invoices } : {}),
        ...(input.dueDate !== undefined ? { dueDate: isoToTimestamp(input.dueDate) } : {}),
        issuedAt: willIssueNow ? serverTimestamp() : (currentRaw.issuedAt ?? null),
        paidAt: willMarkPaidNow ? serverTimestamp() : (currentRaw.paidAt ?? null),
        updatedAt: serverTimestamp(),
      });
      return { invoiceNumber };
    });
  },

  async reissue(propertyId: string, id: string): Promise<string> {
    const ref = doc(billingCollectionRef(propertyId), id);
    return runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error("Billing record not found");
      const currentRaw = snapshot.data() as RawBillingDoc;
      const history = invoiceHistory(currentRaw, id);
      const activeInvoice = [...history].reverse().find((invoice) => invoice.status !== "superseded");
      if (!currentRaw.invoiceNumber || currentRaw.status === "draft" || activeInvoice?.status === "paid") {
        throw new Error("Only unpaid issued bills can be reissued");
      }
      const invoiceNumber = await nextInvoiceNumber(transaction, propertyId, currentRaw.billingMonth);
      const invoices = history.map((invoice) =>
        invoice.status === "issued" ? { ...invoice, status: "superseded" as const } : invoice,
      );
      invoices.push(invoiceSnapshot(currentRaw, invoiceNumber, "issued", new Date().toISOString()));
      transaction.update(ref, {
        invoiceNumber,
        invoices,
        issuedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return invoiceNumber;
    });
  },

  async markInvoicePaid(propertyId: string, id: string, invoiceId: string): Promise<void> {
    const ref = doc(billingCollectionRef(propertyId), id);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists()) throw new Error("Billing record not found");
      const currentRaw = snapshot.data() as RawBillingDoc;
      const invoices = invoiceHistory(currentRaw, id).map((invoice) =>
        invoice.id === invoiceId && invoice.status === "issued" ? { ...invoice, status: "paid" as const } : invoice,
      );
      if (!invoices.some((invoice) => invoice.id === invoiceId)) throw new Error("Invoice not found");
      transaction.update(ref, { invoices, updatedAt: serverTimestamp() });
    });
  },

  async delete(propertyId: string, id: string): Promise<void> {
    await updateDoc(doc(billingCollectionRef(propertyId), id), {
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },
};
