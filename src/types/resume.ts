// 이력서 관련 타입 정의

// 근무 기간
export interface Period {
  startDate: string;
  endDate: string;
}

// 경력
export interface WorkHistory {
  companyName: string;
  position: string;
  period: Period;
  description: string;
}

// 학력
export interface Education {
  name: string;
  period: Period;
}

// 기타 활동
export interface AdditionalInfo {
  name: string;
  date: string;
  type: string; // "수상" | "자격증" | "활동"
  description: string;
}

// 어학 시험
export interface LanguageTest {
  testName: string;
  date: string;
}

// 어학 능력
export interface Language {
  name: string;
  level: string;
  test: LanguageTest[];
}

// 포트폴리오 링크
export interface Portfolio {
  name: string;
  url: string;
}

// 이력서
export interface ResumeContent {
  profile: string;
  workHistory: WorkHistory[];
  education: Education[];
  skill: string[];
  additionalInfo: AdditionalInfo[];
  language: Language[];
  portfolio: Portfolio[];
}

// DB에 저장되는 이력서 레코드
export interface ResumeRecord {
  id: string;
  user_id: string;
  title: string;
  content: ResumeContent;
  created_at: string;
  updated_at: string;
}

// 이력서 생성 요청 바디
export interface CreateResumeBody {
  title: string;
  resume: ResumeContent;
}

// 이력서 수정 요청 바디
export interface UpdateResumeBody {
  title?: string;
  resume?: Partial<ResumeContent>;
}

// 이력서 목록 상세 응답
export interface ResumeResponse {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
}
