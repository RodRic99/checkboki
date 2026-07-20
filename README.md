# 쳌볶이

Chess.com 기보와 Stockfish를 이용해 수순별로 복기하는 Windows 데스크톱 애플리케이션입니다.

## Windows 실행 파일

개발 환경 없이 실행하려면 다음 파일을 더블클릭합니다.

```text
distribution\Checkboki-0.1.2-x64.exe
```

Portable 실행 파일 안에 Java 17 런타임, Spring Boot 백엔드, Stockfish 18이 포함되어 있으므로 별도 설치가 필요하지 않습니다. 처음 실행할 때 압축을 임시 폴더에 푸는 동안 잠시 시간이 걸릴 수 있습니다.

배포 파일을 다시 만들려면 백엔드 `bootJar`를 생성한 뒤 프런트에서 실행합니다.

```powershell
cd backend
.\gradlew.bat bootJar

cd ..\frontend
npm.cmd run dist:win
```

## 구성

- `frontend`: Electron + React + TypeScript + Vite
- `backend`: Spring Boot 3 + Java 17

## 실행

백엔드(Java 17):

```powershell
cd backend
.\gradlew.bat bootRun
```

프런트엔드(별도 터미널):

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

브라우저 UI만 확인하려면 `npm.cmd run dev:web`을 사용합니다.

## Stockfish 설정

[Stockfish 공식 배포판](https://stockfishchess.org/download/)의 Windows 실행 파일을 받은 뒤 환경 변수를 설정합니다.

```powershell
$env:STOCKFISH_PATH="C:\tools\stockfish\stockfish.exe"
cd backend
.\gradlew.bat bootRun
```

또는 `backend/engine/stockfish.exe`에 실행 파일을 둘 수 있습니다. 기본 분석 깊이는 12이며 `STOCKFISH_DEPTH` 환경 변수로 8~20 사이에서 조정할 수 있습니다.

## 현재 기능

- Chess.com 아이디로 최근 3개월 공개 전적 조회
- 조회한 대국을 목록에서 선택하여 PGN 불러오기
- PGN 붙여넣기 및 예제 기보 불러오기
- 체스판에서 처음/이전/다음/마지막 수 탐색
- 수순 목록과 현재 포지션 표시
- Stockfish UCI 분석, 센티폰 손실 및 추천 수 표시
- 백엔드가 꺼져 있을 때 명확한 연결 오류 안내

Chess.com PubAPI는 공개된 대국만 제공하며 로그인이나 비공개 데이터에는 접근하지 않습니다.
