# 마블 룰렛 GitHub 업로드 및 호스팅 가이드

이 프로젝트를 GitHub에 올려서 온라인 링크(GitHub Pages)로 사용하는 방법입니다.

## 1. GitHub 저장소(Repository) 만들기
1. [GitHub](https://github.com/)에 접속하여 로그인합니다.
2. 우측 상단 `+` 버튼을 눌러 **New repository**를 클릭합니다.
3. Repository name에 `marble-roulette`을 입력하고 **Create repository**를 누릅니다.

## 2. 로컬에서 코드 올리기
컴퓨터의 터미널(또는 VS Code 터미널)에서 다음 명령어를 순서대로 입력하세요:

```bash
cd /Users/sunwoongkim/.gemini/antigravity/scratch/marble-roulette

# Git 초기화 및 파일 추가
git init
git add .
git commit -m "Initial commit - Marble Roulette"

# GitHub 연결 (아래 주소의 'USER' 부분을 본인의 GitHub 아이디로 바꾸세요)
git remote add origin https://github.com/USER/marble-roulette.git
git branch -M main
git push -u origin main
```

## 3. 웹사이트 배포하기 (GitHub Pages)
설정해둔 자동 배포 명령어를 실행합니다:

```bash
npm run deploy
```

## 4. 확인하기
1. GitHub 저장소의 **Settings > Pages** 메뉴로 이동합니다.
2. Build and deployment에서 Branch가 `gh-pages`로 설정되어 있는지 확인합니다.
3. 상단에 나타나는 링크 (`https://USER.github.io/marble-roulette/`) 접속 시 게임이 실행됩니다!

> [!IMPORTANT]
> `vite.config.js` 파일에 주소 설정을 완료해 두었으므로, 별도의 추가 설정 없이 바로 배포가 가능합니다.
