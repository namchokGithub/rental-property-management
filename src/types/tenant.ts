export type TenantStatus = "active" | "inactive";

export interface Tenant {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  identificationNumber?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  status: TenantStatus;
  notes?: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreateTenantInput = Omit<
  Tenant,
  "id" | "createdAt" | "updatedAt" | "deletedAt" | "status"
> & {
  status?: TenantStatus;
};
export type UpdateTenantInput = Partial<
  Omit<Tenant, "id" | "createdAt" | "updatedAt" | "deletedAt">
>;
