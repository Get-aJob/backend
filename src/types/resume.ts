// 이력서 관련 타입 정의

export type AdditionalInfoType = "수상" | "자격증" | "활동" | undefined;
export type LanguageLevelType =
  | "유창함"
  | "고급 비즈니스 레벨"
  | "비즈니스 레벨"
  | "일상 회화"
  | undefined;

// 근무 기간
export interface Period {
  startDate: string | null; // 프론트의 Date | null을 문자열(ISO)로 처리
  endDate: string | null;
}

// 경력 (및 기타 경험)
export interface Experience {
  companyName: string;
  position: string;
  period: Period;
  description: string;
}

// 학력
export interface Education {
  name: string;
  period: Period;
  description: string; // 추가됨
}

// 기타 활동
export interface AdditionalInfo {
  name: string;
  date: string | null; // 프론트의 Date | null을 문자열로 처리
  type: AdditionalInfoType; // 타입 변경
  description: string;
}

// 어학 시험
export interface LanguageTest {
  testName: string;
  date: string | null;
  score: string; // 추가됨
}

// 어학 능력
export interface Language {
  name: string;
  level: LanguageLevelType; // 타입 변경
  test: LanguageTest[];
}

// 포트폴리오 링크
export interface Portfolio {
  name: string;
  url: string;
}

// 이력서 내부 데이터 구조
export interface ResumeContent {
  profile: string;
  experience: Experience[]; // 위에서 experience로 가기로 했으므로 유지 (프론트에서도 이 이름으로 맞춰주시면 좋습니다)
  education: Education[];
  skill: string; // string[] -> string으로 변경
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

// 이력서 목록 조회를 위한 경량화된 타입
export type ResumeListItem = Pick<
  ResumeRecord,
  "id" | "title" | "created_at" | "updated_at"
>;

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

// 이력서 목록 응답 (목록 조회, 업로드 시 사용)
export interface ResumeListResponse {
  id: string;
  title: string;
  createdAt: string;
}

// 이력서 상세 응답 (상세 조회 시 사용)
export interface ResumeDetailResponse {
  id: string;
  title: string;
  content: ResumeContent;
  createdAt: string;
}

// 이력서 수정 응답
export interface ResumeUpdateResponse {
  id: string;
  title: string;
  updatedAt: string;
}
