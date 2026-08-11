function invoiceNumber(billingMonth, sequence) {
  const [year, month] = billingMonth.split("-");
  return `INV-${year}-${month}-${String(sequence).padStart(3, "0")}`;
}
function counterId(propertyId, billingMonth) { return `invoice-${propertyId}-${billingMonth}`; }
module.exports = { invoiceNumber, counterId };
