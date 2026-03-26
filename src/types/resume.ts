// 이력서 관련 타입 정의

export type AdditionalInfoType = "수상" | "자격증" | "활동" | null;
export type LanguageLevelType =
  | "유창함"
  | "고급 비즈니스 레벨"
  | "비즈니스 레벨"
  | "일상 회화"
  | null;

export interface Period {
  startDate: string | null;
  endDate: string | null;
}

export interface Experience {
  name: string;
  position: string;
  period: Period;
  description: string;
}

export interface Education {
  name: string;
  period: Period;
  description: string;
}

export interface AdditionalInfo {
  name: string;
  date: string | null;
  type: AdditionalInfoType;
  description: string;
}

export interface LanguageTest {
  testName: string;
  date: string | null;
  score: string;
}

export interface Language {
  name: string;
  level: LanguageLevelType;
  test: LanguageTest[];
}

export interface Portfolio {
  name: string;
  url?: string;
  fileUrl?: string | null;
}

export interface ResumeContent {
  profile: string;
  experience: Experience[];
  education: Education[];
  skill: string;
  additionalInfo: AdditionalInfo[];
  language: Language[];
  portfolio: Portfolio[];
}

export interface ResumeRecord {
  id: string;
  user_id: string;
  title: string;
  content: ResumeContent;
  created_at: string;
  updated_at: string;
}

export type ResumeListItem = Pick<
  ResumeRecord,
  "id" | "title" | "created_at" | "updated_at"
>;

export interface CreateResumeBody {
  title: string;
  resume: ResumeContent;
}

export interface UpdateResumeBody {
  title?: string;
  resume?: Partial<ResumeContent>;
}

export interface ResumeListResponse {
  id: string;
  title: string;
  createdAt: string;
}

export interface ResumeDetailResponse {
  id: string;
  title: string;
  content: ResumeContent;
  createdAt: string;
}

export interface ResumeUpdateResponse {
  id: string;
  title: string;
  updatedAt: string;
}
