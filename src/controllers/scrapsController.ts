import { Request, Response } from 'express';
import {
    toggleScrap,
    getScrapsByUser
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

export async function getMyScrapsHandler(req: AuthRequest, res: Response) {
    try {
        const userId = res.locals.user?.id || req.user?.id;
        if (!userId) {
            return res.status(400).json({ error: '유효한 사용자 정보가 없습니다.' });
        }

        const { limit, offset, sortBy } = req.query;
        const rawSortBy = typeof sortBy === 'string' ? sortBy : 'recent';

        const normalizedOrderBy = rawSortBy === 'deadline' ? 'deadline' : 'created_at';

        const parsedLimit = typeof limit === 'string' ? Number(limit) : 20;
        const parsedOffset = typeof offset === 'string' ? Number(offset) : 0;

        if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
            return res.status(400).json({ error: 'limit은 1~100 사이의 정수여야 합니다.' });
        }
        if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
            return res.status(400).json({ error: 'offset은 0 이상의 정수여야 합니다.' });
        }

        const scraps = await getScrapsByUser(
            userId,
            parsedLimit,
            parsedOffset,
            normalizedOrderBy
        );
        res.status(200).json({ scraps });
    } catch (err) {
        console.error('GET /scraps', err);
        res.status(500).json({ error: '스크랩 조회에 실패했습니다.' });
    }
}