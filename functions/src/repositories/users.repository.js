const { db } = require("../config/firebase");

function findById(uid) {
  return db
    .collection("users")
    .doc(uid)
    .get()
    .then((snapshot) => (snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null));
}

async function exists(uid) {
  return (await db.collection("users").doc(uid).get()).exists;
}

module.exports = { findById, exists };
