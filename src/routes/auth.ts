import { Router } from "express";
import { join, login, me } from "../controllers/authController";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.post("/join", join);
router.post("/login", login);
router.get("/me", requireAuth, me);

export default router;
