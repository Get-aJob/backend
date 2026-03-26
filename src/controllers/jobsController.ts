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

export async function getManualJobsHandler(req: Request, res: Response) {
  try {
    const userId = res.locals.user?.id;
    const sourceType = req.query.sourceType;

    if (!userId) {
      return res.status(401).json({ error: '인증 정보가 없습니다.' });
    }

    if (sourceType !== 'manual') {
      return res.status(400).json({ error: 'sourceType=manual 필터가 필수입니다.' });
    }

    const jobs = await jobsService.getManualJobsByUser(userId);
    res.status(200).json({ jobs });
  } catch (error: any) {
    console.error('GET /api/jobs error:', error);
    res.status(500).json({ error: '데이터 조회 중 오류가 발생했습니다.' });
  }
}
