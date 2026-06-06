import { Chess } from 'chess.js';

export function extractFen(input: string): string {
  const normalizedInput = input
    .replace(/^position\s+fen\s+/i, '')
    .replace(/[“”"]/g, ' ')
    .trim();

  const tokens = normalizedInput.split(/\s+/).filter(Boolean);

  for (let index = 0; index <= tokens.length - 6; index += 1) {
    const candidate = tokens.slice(index, index + 6).join(' ');
    if (isValidFen(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    '입력에서 체스판 상태 코드를 찾지 못했습니다. 웹앱의 "판 상태 코드" 내용을 복사해서 붙여넣어 주세요.',
  );
}

export function isValidFen(fen: string): boolean {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}
