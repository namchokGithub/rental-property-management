const express = require("express");
const { createCorsMiddleware } = require("./config/cors");
const { errorMiddleware, notFoundMiddleware } = require("./middleware/error.middleware");
const { authRouter } = require("./routes/auth.routes");
const { healthRouter } = require("./routes/health.routes");
const { otherChargesRouter } = require("./routes/other-charges.routes");
const { propertiesRouter } = require("./routes/properties.routes");
const { settingsRouter } = require("./routes/settings.routes");
const { roomsRouter } = require("./routes/rooms.routes");
const { tenantsRouter } = require("./routes/tenants.routes");

const app = express();

app.use(createCorsMiddleware());
app.use(express.json());
app.use("/api/v1", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/properties", propertiesRouter);
app.use("/api/v1/properties", settingsRouter);
app.use("/api/v1/properties", otherChargesRouter);
app.use("/api/v1/properties", roomsRouter);
app.use("/api/v1/properties", tenantsRouter);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = { app };
