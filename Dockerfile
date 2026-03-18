# 1. Base image (가볍고 보안에 유리한 alpine 버전 사용)
FROM node:18-alpine

# 2. 컨테이너 내 작업 디렉토리 설정
WORKDIR /app

# 3. 의존성 파일 복사 및 설치 (Docker 레이어 캐싱 활용)
COPY package*.json ./
RUN npm install

# 4. 나머지 소스 코드 복사
COPY . .

# 5. TypeScript 빌드
RUN npm run build

# 6. 컨테이너에서 노출할 포트 (서버에서 사용하는 포트에 맞게 수정)
EXPOSE 3000

# 7. 서버 실행 (빌드 결과 사용)
CMD ["npm", "start"]