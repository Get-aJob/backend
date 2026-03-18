import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./lib/swagger";

import indexRouter from "./routes/index";
import usersRouter from "./routes/users";
import errorRouter from "./routes/error";
import resumeRoutes from "./routes/resumeRoutes";
import authRouter from "./routes/auth";

const app = express();

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/", indexRouter);
app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/api/resumes", resumeRoutes);

app.use(errorRouter);

export default app;
