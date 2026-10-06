# 점심시간

PC와 휴대폰 브라우저에서 주소로 접속하는 Next.js 웹사이트입니다. 설치 없이 식당 또는 메뉴를 고를 수 있습니다. 기본 실행·빌드는 모두 루트의 웹 프로젝트를 사용합니다. `mobile/`은 이전 Expo 소스 보관용이며 웹 실행에 필요하지 않습니다.

## 실행

```bash
npm install
npm run dev
```

http://localhost:3000 에 접속합니다. 홈에서 **식당 고르기**(`/restaurants`) 또는 **메뉴 고르기**(`/menus`)를 선택합니다. ‘식당 추가’에서 이름, 음식 종류, 거리, 정기휴무 요일, 메모를 등록하세요.

휴대폰에서도 확인하려면 `npm run dev:network`로 실행한 뒤 같은 네트워크에서 `http://PC의-IP:3000`에 접속합니다.

## 회사 공용 식당 목록

`.env.example`을 `.env.local`로 복사하고 기존 Supabase 프로젝트의 공개 연결 정보를 설정합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

기존 앱과 같은 프로젝트를 지정하면 같은 회사 식당 목록을 사용합니다. 브라우저의 익명 로그인 세션으로 `lunch_open_company`, `lunch_snapshot`, `lunch_mutate` 함수를 호출하며 기존 RLS를 유지합니다. 별도 가입 화면은 없습니다. 브라우저를 바꾸거나 브라우저 데이터를 지워도 회사 목록은 그대로입니다.

새 Supabase 프로젝트를 사용하는 경우 `supabase/migrations/`의 SQL 두 개를 파일명 순서로 적용하고 Authentication에서 Anonymous Sign-Ins를 활성화합니다. 공개 키만 사용하며 service_role 또는 secret key는 넣지 않습니다. 연결 값은 빌드 시 반영되므로 변경 후 개발 서버를 재시작하거나 다시 빌드합니다.

연결 정보를 설정하지 않으면 기존 로컬 JSON 저장소를 사용합니다. Supabase에 연결된 상태에서 오류가 발생해도 로컬 목록으로 전환하지 않습니다. 두 저장소의 데이터는 자동 합쳐지지 않습니다.

구현 참고: [Supabase 브라우저 클라이언트](https://supabase.com/docs/reference/javascript/initializing), [익명 로그인](https://supabase.com/docs/reference/javascript/auth-signinanonymously).

## 주변 식당 검색

`/nearby`에서 현재 위치 또는 주소·건물명을 기준으로 반경 300m, 500m, 1km, 2km의 식당을 검색합니다. 거리·분류·주소·전화와 지도 링크를 확인하고, 선택한 식당을 공용 목록에 추가할 수 있습니다.

기존 `.env.local`에 REST API 키를 추가합니다. 키는 서버에서만 사용합니다.

```dotenv
KAKAO_REST_API_KEY=발급받은_REST_API_키
```

키 변경 후 개발 서버를 재시작합니다. 설정 파일은 커밋하지 않습니다. 웹 내부 지도를 사용하지 않으므로 JavaScript 키와 SDK 도메인 등록은 필요하지 않습니다.

휴대폰의 현재 위치 기능은 HTTPS와 위치 권한이 필요합니다. PC IP로 접속한 HTTP 개발 화면에서는 주소 검색을 이용합니다. 검색 좌표는 요청에만 사용하고 저장하지 않습니다. 식당을 추가하면 카카오맵 링크와 주소가 메모에 저장됩니다. 팀의 거리 분류와 휴무는 직접 확인해 입력합니다.

카카오 검색 결과는 직선거리 순이며 검색당 최대 45곳입니다. 전체 식당 조사를 보장하지 않습니다. 영업시간·휴무·메뉴 가격은 식당 상세에서 확인합니다.

서버 API: `POST /api/places`에 `{ lat, lng, radius, page }`, `POST /api/places/locations`에 `{ query }`를 전달합니다. [카카오 Local API](https://developers.kakao.com/docs/ko/local/dev-guide).

## 기능

2026-10-06 등록 식당의 거리 기준점은 **서울 영등포구 양평로 12**입니다. 좌표로 계산한 직선거리는 `src/data/office-restaurant-distances.json`에 식당 ID별로 보관합니다. 가까움은 300m 이하, 중간은 300m 초과~600m 이하, 멂은 600m 초과입니다. 도보 경로 거리가 아닙니다. 등록 식당의 지점 표기와 메모는 정리했으며, 메모를 지워도 거리 표시와 정렬은 유지됩니다. 조사 자료와 DB 백업은 로컬 `data/office-research-2026-10-06/`에 보관하며 커밋하지 않습니다.

- 식당 추가, 수정, 삭제와 이름·종류·메모 검색
- 기본 메뉴 24개 중 음식 종류별 무작위 추첨
- 여러 요일의 정기휴무 등록과 자동 추첨 제외
- 식당별 거리(가까움·중간·멂) 저장과 슬라이더로 추첨 최대 거리 선택: 가까움은 가까운 곳만, 중간은 가까움+중간, 멂은 전체
- 서버에서 오늘 가능한 후보를 다시 확인한 뒤 같은 확률로 랜덤 추첨
- 전체·영업중·휴무 필터: 등록된 정기휴무 요일 기준으로 표시
- 식당 목록은 양평로 12 기준 직선거리순으로 정렬하고, 거리 분류 옆에 미터 거리를 표시합니다. 거리가 같으면 이름순, 측정값이 없으면 목록 끝에 표시합니다.
- 식당 카드에는 이름·종류·거리·정기휴무를 표시하며, 상세 메모는 수정 화면에서 확인
- 30초마다, 그리고 창으로 돌아올 때 목록 갱신
- 모바일 화면, 키보드 조작, 오류·빈 목록 안내

## 로컬 모드: JSON 저장

기본 파일은 `data/restaurants.json`입니다. API가 JSON을 읽고 수정하므로 새로고침하거나 서버를 재시작해도 유지됩니다. 브라우저 저장소는 사용하지 않습니다.

```json
[
  {
    "id": "unique-restaurant-id",
    "name": "회사 앞 국밥",
    "category": "한식",
    "distance": "가까움",
    "note": "점심 특선 추천",
    "closedDays": [0, 6],
    "excludedDate": null
  }
]
```

- `closedDays`: 일요일 0, 월요일 1, …, 토요일 6. `[]`는 등록된 정기휴무가 없음.
- `excludedDate`: 한국 날짜 `YYYY-MM-DD` 또는 `null`. 해당 날짜에만 제외합니다.
- `category`: 한식, 중식, 일식, 양식, 분식, 기타.
- `distance`: 가까움, 중간, 멂 또는 `null`(미설정). 기존 파일에 필드가 없어도 미설정으로 읽습니다. 실제 거리 기준은 팀에서 정합니다.
- `id`는 각 식당마다 고유해야 합니다. UI에서 추가하면 UUID가 생성됩니다.
- 이름은 1~50자, 메모는 최대 200자입니다.

직접 파일을 편집할 때는 서버를 잠시 멈추고 편집하세요. API 저장과 수동 파일 편집을 동시에 하면 수동 변경을 잃을 수 있습니다. JSON 형식이 잘못되면 API가 오류를 반환하며 원본을 덮어쓰지 않습니다.

`LUNCH_DATA_FILE` 환경 변수로 저장 파일의 경로를 변경할 수 있습니다. 상대 경로는 앱 실행 폴더 기준입니다.

파일을 수정할 때 잠금 디렉터리로 다른 쓰기를 기다리게 하고, 임시 파일 작성을 마친 뒤 원본 파일을 교체합니다. 서로 다른 식당을 동시에 수정해도 변경이 보존됩니다. 같은 식당의 정보 편집은 마지막 저장이 적용됩니다.

프로세스가 쓰기 도중 강제 종료되어 `.lock` 디렉터리가 남으면 저장이 503 오류로 중단될 수 있습니다. 모든 앱 프로세스가 종료된 것을 확인한 뒤 해당 저장 파일 옆의 `.lock` 디렉터리를 제거하고 재시작하세요.

## 로컬 모드: API

App Router의 Node.js Route Handler를 사용합니다.

| 메서드 | 경로                   | 역할                               |
| ------ | ---------------------- | ---------------------------------- |
| GET    | `/api/restaurants`     | 목록과 한국 날짜·요일 조회         |
| POST   | `/api/restaurants`     | 식당 추가                          |
| PATCH  | `/api/restaurants/:id` | 식당 정보 변경 또는 오늘 제외 설정 |
| DELETE | `/api/restaurants/:id` | 식당 삭제                          |
| POST   | `/api/pick`            | 오늘 가능한 식당 중 하나 추첨      |

추가·정보 변경 요청은 `{ name, category, distance, note, closedDays }`, 오늘 제외 변경은 `{ "excludedToday": true }` 또는 `false`를 보냅니다. 기존 클라이언트가 수정 요청에서 `distance`를 생략하면 저장된 거리를 유지합니다. 목록 응답은 `{ restaurants, today, weekday }`이고, 추첨 응답에는 `picked`가 추가됩니다.

추첨 요청의 `distance`는 최대 거리입니다. `{ "distance": "가까움" }`은 가까운 식당만, `"중간"`은 가까움+중간, `"멂"`은 미설정을 포함한 모든 거리를 허용합니다. 슬라이더 기본값은 멂입니다. 기존 API의 `{ "distance": "all" }`, `{}` 또는 요청 본문 생략도 멂과 동일하게 동작합니다. 휴무·오늘 제외·최대 거리 조건을 모두 적용한 후보가 없으면 409를 반환합니다.

공식 문서: [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers).

## 운영 범위

Supabase 모드는 브라우저에서 공용 DB를 사용합니다. 웹 서버를 재배포해도 식당 목록은 DB에 유지됩니다. 모든 접속자가 회사 목록을 편집할 수 있는 기존 권한 구조이며 회사 소속을 검증하는 로그인은 없습니다. 메뉴 고르기는 DB 연결 없이 사용할 수 있습니다.

아래 파일 보존 조건은 Supabase를 설정하지 않은 로컬 모드에만 해당합니다.

이 버전은 파일 쓰기가 가능하고 파일이 유지되는 로컬 PC 또는 단일 Node.js 서버용입니다. 배포 시 `data` 폴더를 유지하거나 영구 볼륨의 경로를 `LUNCH_DATA_FILE`로 지정하고 백업하세요. 여러 서버 인스턴스나 임시 파일시스템을 쓰는 서버리스 배포에서는 DB 저장소로 교체해야 합니다.

로그인은 없습니다. 앱에 접속할 수 있는 사람은 모두 목록을 편집할 수 있으므로 팀 내부에서 사용하세요. 공개 서비스로 운영한다면 인증을 추가해야 합니다.

## 검증

Node.js 22.17 이상에서:

```bash
npm run lint
npm run build
npm test
npm run format:check
```

API 테스트는 프로덕션 빌드를 별도 포트에서 실행하며 OS 임시 폴더의 전용 JSON 파일만 사용합니다. 실제 식당 목록은 변경하지 않습니다. 한국 시간 자정, 제외 해제, 입력 검증, CRUD, 동시 저장, 추첨 조건, 손상 파일 보존을 확인합니다.

프로덕션 실행:

```bash
npm run build
npm start
```
