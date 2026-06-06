import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import { ChessBoard } from './components/ChessBoard';
import { CoachPanel } from './components/CoachPanel';
import { analyzePosition, type CoachAnalysis } from './lib/coachApi';
import { cloneGame, formatMove, getGameStatus } from './lib/chessUtils';

function App() {
  const [game, setGame] = useState(() => new Chess());
  const [lastMove, setLastMove] = useState<string>('아직 둔 수가 없습니다.');
  const [copyMessage, setCopyMessage] = useState<string>('FEN 복사');
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [coachAnalysis, setCoachAnalysis] = useState<CoachAnalysis | null>(null);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const fenTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const status = useMemo(() => getGameStatus(game), [game]);
  const fen = game.fen();
  const pgn = game.history().length > 0 ? game.pgn() : '아직 기록된 수가 없습니다.';
  const legalMoves = useMemo(() => getLegalMoves(game, selectedSquare), [game, selectedSquare]);
  const squareStyles = useMemo(
    () => buildSquareStyles(selectedSquare, legalMoves),
    [selectedSquare, legalMoves],
  );
  const bestMoveArrow = useMemo(() => buildBestMoveArrow(coachAnalysis?.bestMove), [coachAnalysis]);
  const requestAnalysis = useCallback(
    async (signal?: AbortSignal) => {
      setIsCoachLoading(true);
      setCoachError(null);

      try {
        const result = await analyzePosition(fen, signal);
        setCoachAnalysis(result);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        setCoachError(`코치 서버를 사용할 수 없습니다. 로컬에서는 npm run coach-ui로 실행해 주세요. (${message})`);
      } finally {
        if (!signal?.aborted) {
          setIsCoachLoading(false);
        }
      }
    },
    [fen],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void requestAnalysis(controller.signal);
    }, 500);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [requestAnalysis]);

  function handleMove(sourceSquare: Square, targetSquare: Square): boolean {
    const nextGame = cloneGame(game);
    const move = tryMove(nextGame, sourceSquare, targetSquare);

    if (!move) {
      setLastMove('둘 수 없는 수입니다. 다른 칸을 선택해 주세요.');
      return false;
    }

    setGame(nextGame);
    setLastMove(formatMove(move));
    setSelectedSquare(null);
    setCopyMessage('FEN 복사');
    return true;
  }

  function handleSquareClick(square: Square) {
    if (game.isGameOver()) {
      return;
    }

    if (selectedSquare && legalMoves.some((move) => move.to === square)) {
      handleMove(selectedSquare, square);
      return;
    }

    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
      setLastMove(`${square}의 ${piece.color === 'w' ? '백' : '흑'} 기물을 선택했습니다.`);
      return;
    }

    setSelectedSquare(null);
  }

  async function copyFen() {
    try {
      await navigator.clipboard.writeText(fen);
      setCopyMessage('복사됨');
      window.setTimeout(() => setCopyMessage('FEN 복사'), 1500);
    } catch {
      const didCopy = copyFenFromTextArea();
      setCopyMessage(didCopy ? '복사됨' : '복사 실패');
      window.setTimeout(() => setCopyMessage('FEN 복사'), 1800);
    }
  }

  function copyFenFromTextArea(): boolean {
    const textArea = fenTextAreaRef.current;
    if (!textArea) {
      return false;
    }

    textArea.focus();
    textArea.select();
    return document.execCommand('copy');
  }

  function resetGame() {
    setGame(new Chess());
    setLastMove('아직 둔 수가 없습니다.');
    setSelectedSquare(null);
    setCoachAnalysis(null);
    setCoachError(null);
    setCopyMessage('FEN 복사');
  }

  return (
    <main className="app">
      <section className="playArea">
        <div className="titleRow">
          <div>
            <h1>웹 체스</h1>
            <p>한 브라우저에서 두 사람이 번갈아 둘 수 있습니다.</p>
          </div>
          <button type="button" className="secondaryButton" onClick={resetGame}>
            새 게임
          </button>
        </div>

        <ChessBoard
          position={fen}
          disabled={game.isGameOver()}
          onMove={handleMove}
          onSquareClick={handleSquareClick}
          squareStyles={squareStyles}
          bestMoveArrow={bestMoveArrow}
        />
      </section>

      <aside className="sidePanel">
        <section className={`statusBox ${status.tone}`}>
          <span>상태</span>
          <strong>{status.label}</strong>
          <p>{lastMove}</p>
          {selectedSquare && legalMoves.length > 0 ? (
            <p className="hintText">
              표시된 {legalMoves.length}칸 중 하나를 누르면 그곳으로 이동합니다.
            </p>
          ) : null}
        </section>

        <CoachPanel
          analysis={coachAnalysis}
          error={coachError}
          isLoading={isCoachLoading}
          onAnalyzeNow={() => void requestAnalysis()}
        />

        <section className="dataSection">
          <div className="sectionHeader">
            <div>
              <h2>판 상태 코드</h2>
              <p className="sectionHelp">지금 체스판을 한 줄로 저장한 값입니다. 코치 앱에 붙여넣을 때 씁니다.</p>
            </div>
            <button type="button" onClick={copyFen}>
              {copyMessage}
            </button>
          </div>
          <textarea ref={fenTextAreaRef} value={fen} readOnly aria-label="현재 FEN" />
          <p className="notationName">체스에서는 이 값을 FEN이라고 부릅니다.</p>
        </section>

        <section className="dataSection">
          <h2>수 기록</h2>
          <p className="sectionHelp">지금까지 서로 둔 수를 순서대로 적은 기록입니다.</p>
          <textarea value={pgn} readOnly aria-label="현재 PGN" />
          <p className="notationName">체스에서는 이 기록 형식을 PGN이라고 부릅니다.</p>
        </section>
      </aside>
    </main>
  );
}

function tryMove(game: Chess, sourceSquare: Square, targetSquare: Square): Move | null {
  try {
    return game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });
  } catch {
    return null;
  }
}

function getLegalMoves(game: Chess, square: Square | null): Move[] {
  if (!square) {
    return [];
  }

  return game.moves({ square, verbose: true });
}

function buildSquareStyles(
  selectedSquare: Square | null,
  legalMoves: Move[],
): Record<string, React.CSSProperties> {
  const styles: Record<string, React.CSSProperties> = {};

  if (selectedSquare) {
    styles[selectedSquare] = {
      background: 'rgba(47, 111, 115, 0.45)',
    };
  }

  for (const move of legalMoves) {
    styles[move.to] = {
      background: move.captured
        ? 'radial-gradient(circle, rgba(180, 35, 24, 0.18) 52%, rgba(180, 35, 24, 0.72) 55%, transparent 58%)'
        : 'radial-gradient(circle, rgba(47, 111, 115, 0.8) 18%, transparent 20%)',
    };
  }

  return styles;
}

function buildBestMoveArrow(bestMove?: string): { startSquare: string; endSquare: string; color: string }[] {
  if (!bestMove || bestMove.length < 4) {
    return [];
  }

  return [
    {
      startSquare: bestMove.slice(0, 2),
      endSquare: bestMove.slice(2, 4),
      color: '#4f46e5',
    },
  ];
}

export default App;
