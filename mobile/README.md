# 점심시간 모바일 앱

안드로이드·아이폰용 React Native / Expo SDK 57 앱입니다. Supabase에 식당 목록을 저장하며 별도 Next.js 서버 없이 실행합니다. 첫 화면에서 식당 고르기 또는 메뉴 고르기를 선택합니다. 식당 목록은 회사 공용 Supabase DB에 자동 연결됩니다. 메뉴 고르기는 기본 음식 24개 중 종류별로 무작위 선택하며 기기에서 동작합니다.

## 처음 한 번: Supabase 연결

1. Supabase에서 프로젝트를 만듭니다.
2. SQL Editor에서 [기본 SQL](../supabase/migrations/202609280001_lunch.sql), [회사 공용 목록 SQL](../supabase/migrations/202609280002_company_workspace.sql)을 순서대로 한 번씩 실행합니다.
3. Authentication 설정에서 **Anonymous Sign-Ins**를 활성화합니다. 별도 회원가입 화면 없이 기기별 로그인 세션을 만듭니다.
4. 프로젝트 Connect 또는 API Keys 화면에서 **Project URL**과 **Publishable key**를 확인합니다.
5. 이 폴더의 `.env.example`을 `.env`로 복사하고 두 값을 입력합니다.

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://프로젝트ID.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Publishable key는 앱에 포함되는 공개 키입니다. **service_role, secret key, DB 비밀번호를 앱에 넣지 마세요.** 접근 권한은 로그인 세션과 DB의 RLS로 제한합니다. 2026-09-28에 traverse-lunch 프로젝트에 마이그레이션과 익명 로그인 설정을 적용했습니다. 로컬 `.env` 연결 정보로 HTTP 접속 성공과 세 테이블의 비로그인 접근 차단을 확인했습니다. 실기기 확인은 별도로 진행합니다.

## 실행

Node.js 22.17 이상에서 상위 프로젝트 폴더 기준:

```powershell
npm --prefix mobile install
npm run mobile
```

휴대폰에 SDK 57 호환 Expo Go를 설치하고 QR 코드를 스캔합니다. 개발 중에는 PC와 휴대폰을 같은 와이파이에 연결하세요. 환경 변수를 변경하면 Expo 개발 서버를 재시작합니다.

앱을 열면 회사 공용 목록이 바로 표시됩니다. 별도 팀 생성이나 초대 코드 없이 모든 사용자가 식당을 추가·수정·삭제할 수 있습니다. 기존 목록이 하나 있으면 그대로 사용합니다.

식당·휴무·메모·거리·오늘만 제외 설정은 DB에 저장합니다. 앱 복귀, 당겨서 새로고침, 사용 중 30초 간격으로 변경을 반영합니다. 추첨은 Supabase 함수가 한국 날짜 기준으로 조건을 검사해 같은 확률로 선택합니다. 결과는 추첨한 기기에 표시합니다.

앱을 다시 설치해도 새 익명 세션으로 같은 회사 목록에 자동 연결됩니다. 인터넷 연결이 필요하며 오프라인 편집은 지원하지 않습니다.

## 컴퓨터 미리보기

상위 폴더에서 `npm run mobile:web`을 실행한 뒤 http://localhost:8082 를 엽니다. 같은 모바일 앱 코드를 브라우저에서 실행하며 480px 너비로 표시합니다. 식당 변경은 실제 Supabase DB에 반영됩니다. 휴대폰의 키보드·제스처 등 네이티브 동작은 실기기에서 별도로 확인하세요.

## 설치 파일 및 스토어 빌드

mobile 폴더에서:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview
```

EAS 환경 변수에도 위의 두 공개 연결 값을 설정합니다. preview 프로필은 preview 환경, production 프로필은 production 환경을 사용합니다. app.json의 예시 식별자 `com.lunchclub.mobile`을 실제 배포용 고유 식별자로 바꾸세요.

Android preview는 APK, iOS preview는 등록 기기용 내부 배포 빌드입니다. iOS 배포에는 Apple 개발자 계정과 기기 등록이 필요합니다. 스토어용은 `--profile production`을 사용합니다. Windows에서도 EAS 클라우드 빌드를 요청할 수 있습니다. 현재 서명된 APK/IPA나 스토어 등록은 포함하지 않습니다.

## 검증

```powershell
npm run typecheck
npm run lint
npm test
npm run export:check
```

테스트는 자동 회사 연결, 기존 목록 보존, 중복 연결과 비로그인 차단을 확인합니다. 또한 PGlite PostgreSQL에서 마이그레이션을 적용하고 팀원 공유, 비팀원 조회·수정 차단, 회원 테이블 직접 접근 차단, CRUD, 휴무·제외·거리 추첨을 확인합니다. Supabase Auth의 실제 JWT 검증과 원격 연결은 프로젝트 설정 후 실기기에서 확인해야 합니다. export:check는 Android/iOS JS 번들 검사이며 서명·설치 검사는 별도입니다.

src/lib/domain.ts는 기존 웹 코드 ../src/lib/lunch.ts의 사본입니다. 규칙 변경 시 `npm run sync:domain`으로 갱신하고 SQL 함수도 같은 규칙으로 맞춥니다. 테스트에서 사본 일치를 확인합니다.

기존 웹의 data/restaurants.json과 Supabase 데이터는 별개이며 자동 이전하지 않습니다. 공개 출시 전에는 익명 가입의 남용 방지 설정과 영구 계정 전환·탈퇴 정책을 정해야 합니다. 현재는 사내 배포용 공용 목록입니다. 설치한 모든 사용자가 동일한 목록에 접근하며 회사 소속을 검증하는 로그인은 없습니다.

공식 문서: [React Native 연결](https://supabase.com/docs/guides/auth/quickstarts/react-native), [익명 로그인](https://supabase.com/docs/guides/auth/auth-anonymous), [Expo 빌드](https://docs.expo.dev/build/setup/).
