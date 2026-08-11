export type TenantStatus = "active" | "inactive";

export interface Tenant {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  identificationNumber?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  status: TenantStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateTenantInput = Omit<
  Tenant,
  "id" | "createdAt" | "updatedAt" | "status"
> & {
  status?: TenantStatus;
};
export type UpdateTenantInput = Partial<
  Omit<Tenant, "id" | "createdAt" | "updatedAt">
>;
