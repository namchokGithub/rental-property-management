const { AppError } = require("../errors/app-error");
const { ERROR_CODES } = require("../errors/error-codes");

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function calculateMeterReading(reading, rate, errorCode) {
  if (reading.currentMeter < reading.previousMeter) {
    throw new AppError(400, errorCode, "Current meter reading cannot be lower than previous meter reading");
  }
  const usage = roundMoney(reading.currentMeter - reading.previousMeter);
  return { previousMeter: reading.previousMeter, currentMeter: reading.currentMeter, usage, rate, amount: roundMoney(usage * rate) };
}

function calculateBilling({ rentAmount, electricityInput, electricityRate, waterInput, waterRate, otherCharges }) {
  const electricity = calculateMeterReading(electricityInput, electricityRate, ERROR_CODES.INVALID_ELECTRICITY_METER_READING);
  const water = calculateMeterReading(waterInput, waterRate, ERROR_CODES.INVALID_WATER_METER_READING);
  const otherChargesTotal = roundMoney(otherCharges.reduce((sum, charge) => sum + charge.amount, 0));
  const subtotal = roundMoney(rentAmount + electricity.amount + water.amount);
  return { electricity, water, subtotal, total: roundMoney(subtotal + otherChargesTotal) };
}

function defaultDueDate(billingMonth) {
  const [year, month] = billingMonth.split("-").map(Number);
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-15`;
}

module.exports = { calculateBilling, defaultDueDate, roundMoney };
