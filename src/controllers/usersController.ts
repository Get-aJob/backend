import { Request, Response } from "express";
import { getAllUsers } from "../services/usersService";

export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const data = await getAllUsers();
    res.status(200).json({ users: data });
  } catch (err) {
    console.error("GET /users", err);
    res.status(500).json({ error: "회원 목록 조회에 실패했습니다." });
  }
}
