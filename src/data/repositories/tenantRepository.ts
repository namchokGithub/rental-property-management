import { collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createFirestoreCrudRepository } from "@/data/repositories/firestoreCrud";
import type { CreateTenantInput, Tenant, UpdateTenantInput } from "@/types/tenant";

/**
 * Deleting a tenant that still has an active room assignment would silently
 * orphan that assignment's billing/history. The old backend enforced this;
 * carried over here rather than deferred to the Assignments migration (Task
 * 4) since it's a real data-integrity gap the moment Tenants goes live.
 * `assignments` has no data yet until Task 4 lands, so this always resolves
 * empty for now — harmless, and load-bearing once assignments are written.
 */
async function assertNoActiveAssignment(propertyId: string, tenantId: string): Promise<void> {
  const active = await getDocs(
    query(
      collection(db, "properties", propertyId, "assignments"),
      where("tenantId", "==", tenantId),
      where("status", "==", "active"),
    ),
  );
  if (!active.empty) throw new Error("Cannot delete a tenant with an active room assignment");
}

export const tenantRepository = {
  ...createFirestoreCrudRepository<Tenant, CreateTenantInput, UpdateTenantInput>("tenants"),
  async delete(propertyId: string, id: string): Promise<void> {
    await assertNoActiveAssignment(propertyId, id);
    await deleteDoc(doc(db, "properties", propertyId, "tenants", id));
  },
};
