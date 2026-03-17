const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const { swaggerSpec } = require("./lib/swagger");

const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");
const errorRouter = require("./routes/error");
const resumeRoutes = require("./routes/resumeRoutes").default;

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/api/resumes", resumeRoutes);

app.use(errorRouter);

module.exports = app;
