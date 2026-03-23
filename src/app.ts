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
import applicationRouter from "./routes/applicationsRoutes";
import schedulesRouter from "./routes/schedulesRoutes";

const app = express();

const corpsOptions = {
  origin: [
    "https://job-moa-fe.vercel.app",
    "http://localhost:5173",
    "http://localhost:3009",
  ],
  credentials: true,
};

app.use(cors(corpsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/", indexRouter);
app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/api/resumes", resumeRoutes);
app.use("/applications", applicationRouter);
app.use("/schedules", schedulesRouter);

app.use(errorRouter);

export default app;
