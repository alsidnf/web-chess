import { Chessboard } from 'react-chessboard';
import type { Square } from 'chess.js';

type ChessBoardProps = {
  position: string;
  disabled: boolean;
  onMove: (sourceSquare: Square, targetSquare: Square) => boolean;
  onSquareClick: (square: Square) => void;
  squareStyles: Record<string, React.CSSProperties>;
  bestMoveArrow: { startSquare: string; endSquare: string; color: string }[];
};

export function ChessBoard({
  position,
  disabled,
  onMove,
  onSquareClick,
  squareStyles,
  bestMoveArrow,
}: ChessBoardProps) {
  function handlePieceDrop({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean {
    if (!targetSquare) {
      return false;
    }

    return onMove(sourceSquare as Square, targetSquare as Square);
  }

  return (
    <div className="boardShell" aria-label="체스판">
      <Chessboard
        options={{
          id: 'beginner-chess-board',
          position,
          allowDragging: !disabled,
          onPieceDrop: handlePieceDrop,
          onSquareClick: ({ square }) => onSquareClick(square as Square),
          squareStyles,
          arrows: bestMoveArrow,
          boardStyle: {
            borderRadius: '8px',
            boxShadow: '0 16px 45px rgba(20, 28, 40, 0.18)',
            maxWidth: '560px',
            width: '100%',
          },
        }}
      />
    </div>
  );
}
