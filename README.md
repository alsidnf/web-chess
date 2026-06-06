# Web Chess

A beginner-friendly chess project with two parts:

- A React/Vite web chess board for two people sharing one browser.
- A local Stockfish coach CLI that reads a FEN position and explains the engine recommendation in simple language.

Stockfish calculates the move. The app only sends FEN to the UCI engine, parses `bestmove`, and explains the result for a beginner.

## Install

```bash
npm install
```

## Run the Web App Locally

```bash
npm run dev
```

Open the Vite URL shown in the terminal. Two players can move pieces by dragging them on the same board. Illegal moves are rejected by `chess.js`.

The app shows:

- turn, check, checkmate, stalemate, and draw status
- current FEN with a copy button
- current PGN
- reset button

## Run the Local Stockfish Coach UI

로컬에서 Stockfish 분석까지 화면으로 보고 싶으면 이 명령을 씁니다.

```bash
npm run coach-ui
```

브라우저에서 `http://127.0.0.1:5173/web-chess/`를 열면 체스판과 `Stockfish 코치` 패널이 함께 보입니다.

이 모드에서는 사용자가 FEN을 복사해서 붙여넣을 필요가 없습니다. 체스판의 현재 상태를 앱이 자동으로 읽고, 로컬 Node 서버가 Stockfish에 전달한 뒤, 추천 수와 후보 수 3개를 다시 화면에 보여줍니다.

```text
체스판
-> chess.js가 현재 판 상태를 FEN으로 만듦
-> 로컬 서버 /api/analyze
-> Stockfish UCI 분석
-> 화면에 추천 수, 후보 수, 설명 표시
```

Windows에서는 바탕 화면의 `웹체스_통합실행.cmd`를 더블클릭해도 됩니다. 이 실행 파일은 웹앱과 코치 서버를 함께 켜고 브라우저를 열어 줍니다. 실행 창에서 Enter를 누르면 웹앱과 코치 서버를 한 번에 종료합니다.

## GitHub Pages Deployment

This project is configured for `https://alsidnf.github.io/web-chess/`.

The Vite base path is set in `vite.config.ts`:

```ts
base: '/web-chess/'
```

Recommended deployment is GitHub Actions. Push to `main`, then in the GitHub repository settings enable Pages with GitHub Actions as the source. The workflow is in `.github/workflows/deploy.yml`.

Manual deployment with `gh-pages` is also available:

```bash
npm run deploy
```

## Stockfish Setup

The coach app uses a local Stockfish executable because that is the most reliable cross-platform MVP for a UCI engine.

현재 Windows에서는 다음 명령으로 설치할 수 있습니다.

```powershell
winget install --id Stockfish.Stockfish --accept-source-agreements --accept-package-agreements
```

Install Stockfish:

- Windows: download Stockfish from the official Stockfish site, then set `STOCKFISH_PATH` to the `.exe`.
- macOS: `brew install stockfish`
- Linux: use your package manager, for example `sudo apt install stockfish`

If `stockfish` is already available in your PATH, no extra setup is needed.

Windows PowerShell example:

```powershell
$env:STOCKFISH_PATH="C:\Tools\stockfish\stockfish.exe"
npm run coach
```

macOS/Linux example:

```bash
export STOCKFISH_PATH="/usr/local/bin/stockfish"
npm run coach
```

## Use the Coach / 코치 사용법

1. 웹앱을 실행합니다.
2. 체스를 몇 수 둡니다.
3. 오른쪽 `판 상태 코드` 영역에서 내용을 복사합니다.
4. 실행합니다.

```bash
npm run coach
```

5. 물어보면 복사한 내용을 붙여넣습니다.

코치는 붙여넣은 내용에서 FEN만 자동으로 찾습니다. 그래서 아래처럼 주변 문장이 섞여 있어도 됩니다.

```text
판 상태 코드:
rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1
체스에서는 이 값을 FEN이라고 부릅니다.
```

명령어에 바로 넣어도 됩니다.

```bash
npm run coach -- "판 상태 코드: rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
```

The coach sends this UCI flow to Stockfish:

```text
uci
isready
position fen <FEN>
go depth 12
```

It prints the best move, up to three candidate moves when MultiPV is available, evaluation values, and a beginner explanation.

## Beginner Example

Paste the normal starting position:

```text
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
```

Stockfish may recommend a central pawn or knight development move. The explanation will describe which piece moves, why the move helps, whether it creates a direct threat, and what beginner idea to remember.

## Scripts

```bash
npm run dev      # local web app
npm run build    # type-check and production build
npm run preview  # preview production build
npm run coach    # local Stockfish coach
npm run deploy   # manual gh-pages deployment
npm run coach-ui # local web chess app with Stockfish coach panel
```
