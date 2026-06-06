import { Chess, type Move } from 'chess.js';

export type GameStatus = {
  label: string;
  tone: 'playing' | 'check' | 'ended';
};

export function cloneGame(game: Chess): Chess {
  return new Chess(game.fen());
}

export function getGameStatus(game: Chess): GameStatus {
  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? '흑' : '백';
    return { label: `체크메이트입니다. ${winner}이 이겼습니다.`, tone: 'ended' };
  }

  if (game.isStalemate()) {
    return { label: '스테일메이트입니다. 무승부입니다.', tone: 'ended' };
  }

  if (game.isDraw()) {
    return { label: '무승부입니다.', tone: 'ended' };
  }

  const sideToMove = game.turn() === 'w' ? '백' : '흑';
  if (game.isCheck()) {
    return { label: `${sideToMove}이 체크 상태입니다.`, tone: 'check' };
  }

  return { label: `${sideToMove} 차례입니다.`, tone: 'playing' };
}

export function formatMove(move: Move): string {
  const pieceName = pieceNames[move.piece] ?? '기물';
  const captureText = move.captured ? `${move.to}의 ${pieceNames[move.captured]}을 잡았습니다` : `${move.to}로 이동했습니다`;
  const promotionText = move.promotion ? ` ${pieceNames[move.promotion]}으로 승급했습니다.` : '';

  return `${pieceName}이 ${move.from}에서 ${captureText}.${promotionText}`;
}

const pieceNames: Record<string, string> = {
  p: '폰',
  n: '나이트',
  b: '비숍',
  r: '룩',
  q: '퀸',
  k: '킹',
};
