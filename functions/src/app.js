const express = require("express");
const { createCorsMiddleware } = require("./config/cors");
const { errorMiddleware, notFoundMiddleware } = require("./middleware/error.middleware");
const { healthRouter } = require("./routes/health.routes");

const app = express();

app.use(createCorsMiddleware());
app.use(express.json());
app.use("/api/v1", healthRouter);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = { app };
