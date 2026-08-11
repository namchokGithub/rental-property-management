const { FieldValue } = require("firebase-admin/firestore");
const { db } = require("../config/firebase");
const invoices = db.collection("invoices"); const billingRecords = db.collection("billingRecords"); const counters = db.collection("counters"); const settings = db.collection("propertySettings");
const toDocument = (snapshot) => (snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null);
async function findAllByProperty(propertyId, filters = {}) { const records = (await invoices.where("propertyId", "==", propertyId).orderBy("issuedAt", "desc").get()).docs.map(toDocument); return records.filter((invoice) => Object.entries(filters).every(([key, value]) => invoice[key] === value)); }
async function findById(id) { return toDocument(await invoices.doc(id).get()); }
async function findByBillingId(propertyId, billingId) { const result = await invoices.where("propertyId", "==", propertyId).where("billingId", "==", billingId).limit(1).get(); return result.empty ? null : toDocument(result.docs[0]); }
function invoiceByBillingQuery(propertyId, billingId) { return invoices.where("propertyId", "==", propertyId).where("billingId", "==", billingId).limit(1); }
module.exports = { db, FieldValue, toDocument, findAllByProperty, findById, findByBillingId, invoiceByBillingQuery, references: { invoices, billingRecords, counters, settings } };
