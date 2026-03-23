import { Request, Response } from "express";
import { getSchedules } from "../services/schedulesService";

function isIsoDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function getSingleQueryString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  return undefined;
}

export async function listSchedules(req: Request, res: Response) {
  try {
    const startDate = getSingleQueryString(req.query.startDate);
    const endDate = getSingleQueryString(req.query.endDate);
    const rawAppliedYN = getSingleQueryString(req.query.appliedYN ?? req.query.appliedYn);

    if ((startDate && !endDate) || (!startDate && endDate)) {
      return res.status(400).json({ error: "startDate와 endDate는 함께 전달해야 합니다." });
    }

    if (startDate && !isIsoDateOnly(startDate)) {
      return res.status(400).json({ error: "startDate는 YYYY-MM-DD 형식이어야 합니다." });
    }

    if (endDate && !isIsoDateOnly(endDate)) {
      return res.status(400).json({ error: "endDate는 YYYY-MM-DD 형식이어야 합니다." });
    }

    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({ error: "startDate는 endDate보다 클 수 없습니다." });
    }

    let appliedYN: "Y" | "N" | undefined;
    if (rawAppliedYN !== undefined) {
      const normalized = rawAppliedYN.trim().toUpperCase();
      if (normalized !== "Y" && normalized !== "N") {
        return res.status(400).json({ error: "appliedYN/appliedYn은 Y 또는 N만 허용됩니다." });
      }
      appliedYN = normalized;
    }

    const userId = res.locals.user?.id as string | undefined;
    if (appliedYN && !userId) {
      return res.status(400).json({ error: "appliedYN/appliedYn은 로그인 사용자만 사용할 수 있습니다." });
    }
    const schedules = await getSchedules({
      startDate,
      endDate,
      appliedYN,
      userId,
    });

    return res.status(200).json({ schedules });
  } catch (err) {
    console.error("GET /schedules", err);
    return res.status(500).json({ error: "일정 조회에 실패했습니다." });
  }
}
