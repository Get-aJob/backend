import { Request, Response } from 'express';
import * as jobsService from '../services/jobsService';

export async function manualCrawlHandler(req: Request, res: Response) {
  try {
    const { url } = req.body;
    const userId = res.locals.user?.id;

    if (!url) {
      return res.status(400).json({ error: 'URL은 필수입니다.' });
    }

    if (!userId) {
      return res.status(401).json({ error: '인증 정보가 없습니다.' });
    }

    const job = await jobsService.crawlAndSaveJob(url, userId);
    res.status(201).json({ job });
  } catch (error: any) {
    console.error('POST /api/jobs/manual error:', error);
    res.status(500).json({ error: '크롤링 또는 저장 중 오류가 발생했습니다.' });
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
