const { app } = require("./app");
const { auth, db, firebaseApp } = require("./config/firebase");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(firebaseApp, "Firebase Admin app was not initialized");
assert(auth, "Firebase Admin Auth instance was not created");
assert(db, "Firestore instance was not created");
assert(app, "Express application was not created");

async function verifyHttpResponses() {
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();

    const healthResponse = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    const healthBody = await healthResponse.json();
    assert(healthResponse.status === 200, "Health endpoint did not return HTTP 200");
    assert(healthBody.success === true && healthBody.data.status === "ok", "Health endpoint response was not standardized");

    const missingResponse = await fetch(`http://127.0.0.1:${port}/api/v1/missing`);
    const missingBody = await missingResponse.json();
    assert(missingResponse.status === 404, "Unknown API route did not return HTTP 404");
    assert(
      missingBody.success === false && missingBody.error.code === "NOT_FOUND",
      "Unknown API route response was not standardized"
    );
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

verifyHttpResponses()
  .then(() => process.stdout.write("Backend foundation smoke check passed.\n"))
  .catch((error) => {
    process.stderr.write(`Backend foundation smoke check failed: ${error.message}\n`);
    process.exitCode = 1;
  });
