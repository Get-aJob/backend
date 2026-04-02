import { Request, Response } from 'express';
import * as jobsService from '../services/jobsService';
import {
  createDirectJob,
  updateDirectJob,
  getDirectJobsByUser,
  deleteDirectJob,
} from "../services/jobsService";


export async function manualPreviewHandler(req: Request, res: Response) {
  try {
    const { url } = req.body;
    const userId = res.locals.user?.id;

    if (!url) return res.status(400).json({ error: 'URL은 필수입니다.' });
    if (!userId) return res.status(401).json({ error: '인증 정보가 없습니다.' });

    const preview = await jobsService.crawlJob(url);
    return res.status(200).json({ preview });
  } catch (error: any) {
    console.error('POST /api/jobs/manual/preview error:', error);
    res.status(500).json({ error: '크롤링 중 오류가 발생했습니다.' });
  }
}

export async function manualSaveHandler(req: Request, res: Response) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) return res.status(401).json({ error: '인증 정보가 없습니다.' });

    const { title, companyName, sourceUrl, externalId, ...rest } = req.body;

    if (!title) return res.status(400).json({ error: 'title은 필수입니다.' });
    if (!companyName) return res.status(400).json({ error: 'companyName은 필수입니다.' });
    if (!externalId) return res.status(400).json({ error: 'externalId는 필수입니다.' });

    const job = await jobsService.saveManualJob(userId, { title, companyName, sourceUrl, externalId, ...rest });
    return res.status(201).json({ job });
  } catch (error: any) {
    console.error('POST /api/jobs/manual/save error:', error);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다.' });
  }
}


export async function getJobsHandler(req: Request, res: Response) {
  try {
    const userId = res.locals.user?.id;
    const sourceType = req.query.sourceType as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!sourceType) {
      return res.status(400).json({ error: "sourceType 필터가 필수입니다. (auto 또는 manual)" });
    }

    if (sourceType === "auto") {
      const result = await jobsService.getAutoJobs(limit, offset);
      return res.status(200).json({ 
        jobs: result.jobs,
        totalCount: result.totalCount,
        sourceSites: result.sourceSites
      });
    } else if (sourceType === "manual") {
      if (!userId) {
        return res.status(401).json({ error: "인증 정보가 없습니다." });
      }
      const jobs = await jobsService.getManualJobsByUser(userId);
      return res.status(200).json({ jobs });
    } else {
      return res.status(400).json({ error: "유효하지 않은 sourceType입니다. (auto 또는 manual)" });
    }
  } catch (error: any) {
    console.error("GET /jobs error:", error);
    res.status(500).json({ error: "데이터 조회 중 오류가 발생했습니다." });
  }
}

export async function deleteManualJobHandler(req: Request, res: Response) {
  try {
    const userId = res.locals.user?.id;
    const externalId = req.params.externalId as string;

    if (!userId) {
      return res.status(401).json({ error: "인증 정보가 없습니다." });
    }

    if (!externalId || typeof externalId !== 'string') {
      return res.status(400).json({ error: "externalId가 필요합니다." });
    }

    const deleted = await jobsService.deleteManualJob(userId, externalId);

    if (!deleted) {
      return res.status(404).json({ error: "해당 공고를 찾을 수 없거나 삭제 권한이 없습니다." });
    }

    res.status(204).send();
  } catch (error: any) {
    console.error("DELETE /jobs/manual/:externalId error:", error);
    res.status(500).json({ error: "공고 삭제 중 오류가 발생했습니다." });
  }
}


const DIRECT_JOB_CREATE_ALLOWED_FIELDS = [
  "title", "companyName", "location", "experience",
  "companyLogo", "deadline", "deadlineText", "description", "sourceUrl"
];

const DIRECT_JOB_UPDATE_ALLOWED_FIELDS = [
  "title", "companyName", "location", "experience",
  "companyLogo", "deadline", "deadlineText", "description", "sourceUrl"
];

export async function createDirectJobHandler(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { title, companyName, ...rest } = req.body;

  if (!title || typeof title !== "string") {
    return res.status(400).json({ error: "title은 필수 항목입니다." });
  }
  if (!companyName || typeof companyName !== "string") {
    return res.status(400).json({ error: "companyName은 필수 항목입니다." });
  }

  const filteredData: Record<string, any> = { title, companyName };
  for (const field of DIRECT_JOB_CREATE_ALLOWED_FIELDS) {
    if (field in rest) filteredData[field] = rest[field];
  }

  try {
    const job = await createDirectJob(user.id, filteredData as any);
    return res.status(201).json(job);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export async function updateDirectJobHandler(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const externalId = req.params.externalId as string;

  const filteredData: Record<string, any> = {};
  for (const field of DIRECT_JOB_UPDATE_ALLOWED_FIELDS) {
    if (field in req.body) filteredData[field] = req.body[field];
  }

  if (Object.keys(filteredData).length === 0) {
    return res.status(400).json({ error: "수정할 항목이 없습니다." });
  }

  try {
    const job = await updateDirectJob(user.id, externalId, filteredData as any);
    return res.status(200).json(job);
  } catch (err: any) {
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ error: "공고를 찾을 수 없습니다." });
    }
    return res.status(500).json({ error: err.message });
  }
};

export async function getDirectJobsHandler(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  try {
    const result = await getDirectJobsByUser(user.id, limit, offset);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export async function deleteDirectJobHandler(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const externalId = req.params.externalId as string;

  try {
    const deleted = await deleteDirectJob(user.id, externalId);
    if (!deleted) {
      return res.status(404).json({ error: "해당 공고를 찾을 수 없거나 삭제 권한이 없습니다." });
    }
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

