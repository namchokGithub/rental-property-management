const express = require("express");
const { createCorsMiddleware } = require("./config/cors");
const { errorMiddleware, notFoundMiddleware } = require("./middleware/error.middleware");
const { authRouter } = require("./routes/auth.routes");
const { healthRouter } = require("./routes/health.routes");

const app = express();

app.use(createCorsMiddleware());
app.use(express.json());
app.use("/api/v1", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = { app };
