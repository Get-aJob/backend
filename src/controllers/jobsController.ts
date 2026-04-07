import { Request, Response } from 'express';
import * as jobsService from '../services/jobsService';

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

export async function createManualJobHandler(req: Request, res: Response) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) return res.status(401).json({ error: '인증 정보가 없습니다.' });

    const { title, companyName, ...rest } = req.body;

    if (!title) return res.status(400).json({ error: 'title은 필수입니다.' });
    if (!companyName) return res.status(400).json({ error: 'companyName은 필수입니다.' });

    const ALLOWED_FIELDS = [
      "externalId", "sourceUrl", "companyLogo", "location", "experience",
      "deadline", "deadlineText", "description", "content",
    ];
    const filteredRest: Record<string, any> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in rest) filteredRest[field] = rest[field];
    }

    const job = await jobsService.saveManualJob(userId, { title, companyName, ...filteredRest });
    return res.status(201).json({ job });
  } catch (error: any) {
    console.error('POST /api/jobs/manual error:', error);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다.' });
  }
}



export async function getJobsHandler(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const sourceType = req.query.sourceType as string;

    if (!sourceType) {
      return res.status(400).json({ error: "sourceType 필터가 필수입니다. (auto)" });
    }

    if (sourceType === "auto") {
      const result = await jobsService.getAutoJobs(limit, offset);
      return res.status(200).json({
        jobs: result.jobs,
        totalCount: result.totalCount,
        sourceSites: result.sourceSites,
      });
    } else {
      return res.status(400).json({ error: "유효하지 않은 sourceType입니다. (auto)" });
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

export async function updateManualJobHandler(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: "인증 정보가 없습니다." });

  const externalId = req.params.externalId as string;

  const ALLOWED_FIELDS = [
    "title", "companyName", "location", "experience",
    "companyLogo", "deadline", "deadlineText", "description", "sourceUrl",
  ];
  const filteredData: Record<string, any> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in req.body) filteredData[field] = req.body[field];
  }

  if (Object.keys(filteredData).length === 0) {
    return res.status(400).json({ error: "수정할 항목이 없습니다." });
  }

  try {
    const job = await jobsService.updateManualJob(user.id, externalId, filteredData as any);
    return res.status(200).json(job);
  } catch (err: any) {
    if (err.code === "NOT_FOUND") {
      return res.status(404).json({ error: "공고를 찾을 수 없습니다." });
    }
    return res.status(500).json({ error: err.message });
  }
}

export async function getManualJobsHandler(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: "인증 정보가 없습니다." });

  const parsedLimit = parseInt(String(req.query.limit ?? "20"), 10);
  const parsedOffset = parseInt(String(req.query.offset ?? "0"), 10);
  const limit = Math.min(isNaN(parsedLimit) || parsedLimit < 1 ? 20 : parsedLimit, 100);
  const offset = isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset;

  try {
    const result = await jobsService.getManualJobsByUser(user.id, limit, offset);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getManualJobHandler(req: Request, res: Response) {
  const user = res.locals.user;
  if (!user) return res.status(401).json({ error: "인증 정보가 없습니다." });

  const externalId = req.params.externalId as string;

  try {
    const job = await jobsService.getManualJobByExternalId(user.id, externalId);
    if (!job) {
      return res.status(404).json({ error: "해당 공고를 찾을 수 없습니다." });
    }
    return res.status(200).json({ job });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getJobByIdHandler(req: Request, res: Response) {
  const jobId = req.params.jobId as string;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(jobId)) {
    return res.status(400).json({ error: "jobId 형식이 올바르지 않습니다." });
  }

  try {
    const job = await jobsService.getJobById(jobId);
    if (!job) {
      return res.status(404).json({ error: "해당 공고를 찾을 수 없습니다." });
    }
    return res.status(200).json({ job });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

export async function incrementViewCountHandler(req: Request, res: Response) {
  const jobId = req.params.jobId as string;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(jobId)) {
    return res.status(400).json({ error: "jobId 형식이 올바르지 않습니다." });
  }

  try {
    const result = await jobsService.incrementViewCount(jobId);
    if (!result) {
      return res.status(404).json({ error: "해당 공고를 찾을 수 없습니다." });
    }
    return res.status(200).json({ viewCount: (result as any).viewCount });
  } catch (err: any) {
    console.error("PATCH /jobs/:jobId/view error:", err);
    return res.status(500).json({ error: "조회수 업데이트 중 오류가 발생했습니다." });
  }
}

