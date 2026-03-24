import { Request, Response } from 'express';
import {
    toggleScrap
} from '../services/scrapsService';

type AuthUser = {
    id?: string;
    payload?: unknown;
}

type AuthRequest = Request & {
    user ? : AuthUser;
}

export async function toggleScrapHandler(req: AuthRequest, res: Response) {
    try {
        const userId = res.locals.user?.id || req.user?.id;
        if (!userId) {
            return res.status(400).json({ error: '유효한 사용자 정보가 없습니다.' });
        }
        const jobPostingId = req.params.jobPostingId;
        if (!jobPostingId || typeof jobPostingId !== 'string') {
            return res.status(400).json({ error: '유효한 공고 ID가 없습니다.' });
        }
        const result = await toggleScrap(userId, jobPostingId);
        res.status(200).json({ scrap: result });
    } catch (err) {
        console.error('POST /scraps/:jobPostingId', err);
        res.status(500).json({ error: '스크랩 처리에 실패했습니다.' });
    }
}