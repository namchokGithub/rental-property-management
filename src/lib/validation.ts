import type { CreateRoomInput, UpdateRoomInput } from "@/types/room";
import type { CreateTenantInput, UpdateTenantInput } from "@/types/tenant";
import type { CreateBillingInput } from "@/types/billing";

export type ValidationErrors = Record<string, string>;

export function validateRoom(input: Partial<CreateRoomInput & UpdateRoomInput>): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!input.roomNumber || input.roomNumber.trim() === "") errors.roomNumber = "validation.room.roomNumberRequired";
  if (input.monthlyRent !== undefined && input.monthlyRent < 0) errors.monthlyRent = "validation.room.monthlyRentNegative";
  if (input.electricityRate !== undefined && input.electricityRate < 0) errors.electricityRate = "validation.room.electricityRateNegative";
  if (input.waterRate !== undefined && input.waterRate < 0) errors.waterRate = "validation.room.waterRateNegative";
  return errors;
}

export function validateTenant(input: Partial<CreateTenantInput & UpdateTenantInput>): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!input.firstName || input.firstName.trim() === "") errors.firstName = "validation.tenant.firstNameRequired";
  if (!input.lastName || input.lastName.trim() === "") errors.lastName = "validation.tenant.lastNameRequired";
  return errors;
}

export function validateBilling(input: Partial<CreateBillingInput>): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!input.roomId) errors.roomId = "validation.billing.roomRequired";
  if (!input.billingMonth) errors.billingMonth = "validation.billing.billingMonthRequired";
  if (
    input.electricityCurrentMeter !== undefined &&
    input.electricityPreviousMeter !== undefined &&
    input.electricityCurrentMeter < input.electricityPreviousMeter
  ) {
    errors.electricityCurrentMeter = "validation.billing.electricityMeterInvalid";
  }
  if (
    input.waterCurrentMeter !== undefined &&
    input.waterPreviousMeter !== undefined &&
    input.waterCurrentMeter < input.waterPreviousMeter
  ) {
    errors.waterCurrentMeter = "validation.billing.waterMeterInvalid";
  }
  if (input.rentAmount !== undefined && input.rentAmount < 0) errors.rentAmount = "validation.billing.rentNegative";
  return errors;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(input: { email: string; password: string }): ValidationErrors {
  const errors: ValidationErrors = {};
  const email = input.email.trim();
  if (!email) {
    errors.email = "auth.error.emailRequired";
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "auth.error.emailInvalid";
  }
  if (!input.password) errors.password = "auth.error.passwordRequired";
  return errors;
}
