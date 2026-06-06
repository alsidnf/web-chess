import { Chess, type Move } from 'chess.js';
import type { CandidateMove, EngineEvaluation } from './stockfishClient';

export type MoveExplanation = {
  moveText: string;
  reason: string;
  safety: string;
  beginnerTip: string;
};

export function explainBestMove(fen: string, bestMove: string, candidates: CandidateMove[]): MoveExplanation {
  const game = new Chess(fen);
  const move = makeUciMove(game, bestMove);
  const candidate = candidates.find((item) => item.move === bestMove) ?? candidates[0];
  const mover = move.color === 'w' ? '백' : '흑';
  const piece = pieceNames[move.piece];
  const capture = move.captured ? ` ${pieceNames[move.captured]}을 잡는 수입니다.` : '';
  const promotion = move.promotion ? ` ${pieceNames[move.promotion]}으로 승급합니다.` : '';
  const evaluation = candidate?.evaluation ? ` Stockfish 평가: ${formatEvaluation(candidate.evaluation)}.` : '';

  const replyCount = game.moves().length;
  const safety =
    replyCount === 0
      ? '이 수를 두면 상대가 둘 수 있는 합법적인 수가 없습니다.'
      : `이 수를 둔 뒤에도 상대에게 ${replyCount}개의 합법적인 응수가 있습니다. 다음에는 상대의 체크, 잡기, 위협을 꼭 확인하세요.`;

  return {
    moveText: `${mover}은 ${bestMove}를 추천합니다. ${piece}을 ${move.from}에서 ${move.to}로 움직입니다.${capture}${promotion}`,
    reason: buildReason(game, move, evaluation),
    safety,
    beginnerTip: buildBeginnerTip(move),
  };
}

export function formatEvaluation(evaluation: EngineEvaluation): string {
  if (evaluation.type === 'mate') {
    const side = evaluation.value > 0 ? '둘 차례인 쪽' : '상대';
    return `${side}이 ${Math.abs(evaluation.value)}수 안에 체크메이트 가능`;
  }

  const pawns = evaluation.value / 100;
  const sign = pawns > 0 ? '+' : '';
  return `${sign}${pawns.toFixed(2)}폰 정도`;
}

function makeUciMove(game: Chess, uciMove: string): Move {
  const from = uciMove.slice(0, 2);
  const to = uciMove.slice(2, 4);
  const promotion = uciMove.slice(4, 5) || undefined;
  const move = game.move({ from, to, promotion });

  if (!move) {
    throw new Error(`Stockfish returned "${uciMove}", but chess.js could not apply it to the FEN.`);
  }

  return move;
}

function buildReason(gameAfterMove: Chess, move: Move, evaluation: string): string {
  if (gameAfterMove.isCheckmate()) {
    return `이 수는 체크메이트로 게임을 끝내기 때문에 가장 좋습니다.${evaluation}`;
  }

  if (gameAfterMove.isCheck()) {
    return `이 수는 체크를 걸어 상대가 킹 위협부터 해결하게 만들기 때문에 강합니다.${evaluation}`;
  }

  if (move.captured) {
    return `이 수는 기물을 잡으면서 Stockfish가 좋게 보는 진행을 이어가기 때문에 유용합니다.${evaluation}`;
  }

  if (move.flags.includes('k') || move.flags.includes('q')) {
    return `이 수는 캐슬링이라 킹을 더 안전하게 만들고 룩을 중앙 쪽으로 연결해 줍니다.${evaluation}`;
  }

  return `Stockfish는 이 수가 당장 큰 전술적 약점을 만들지 않으면서 포지션을 개선한다고 봅니다.${evaluation}`;
}

function buildBeginnerTip(move: Move): string {
  if (move.captured) {
    return '초보자 포인트: 기물을 잡기 전에는 내 기물이 바로 되잡히는지 확인하세요. 좋은 교환은 이득을 보거나 최소한 손해를 보지 않습니다.';
  }

  if (move.piece === 'k') {
    return '초보자 포인트: 킹 안전이 중요합니다. 판이 단순해지기 전에는 킹을 위험한 곳으로 움직이지 마세요.';
  }

  if (move.piece === 'n' || move.piece === 'b') {
    return '초보자 포인트: 나이트와 비숍을 전개하면 내 기물이 더 많은 칸을 공격하게 됩니다.';
  }

  return '초보자 포인트: 매 수마다 양쪽의 체크, 잡을 수 있는 기물, 위협을 순서대로 확인하세요.';
}

const pieceNames: Record<string, string> = {
  p: '폰',
  n: '나이트',
  b: '비숍',
  r: '룩',
  q: '퀸',
  k: '킹',
};
