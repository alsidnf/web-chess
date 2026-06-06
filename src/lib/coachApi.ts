export type CoachCandidate = {
  multipv: number;
  move: string;
  evaluationText: string;
  depth?: number;
  pv: string[];
};

export type CoachExplanation = {
  moveText: string;
  reason: string;
  safety: string;
  beginnerTip: string;
};

export type CoachAnalysis = {
  bestMove: string;
  candidates: CoachCandidate[];
  explanation: CoachExplanation;
};

export async function analyzePosition(fen: string, signal?: AbortSignal): Promise<CoachAnalysis> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fen }),
    signal,
  });

  const data = (await response.json()) as CoachAnalysis | { error?: string };
  if (!response.ok) {
    throw new Error('error' in data && data.error ? data.error : '분석에 실패했습니다.');
  }

  return data as CoachAnalysis;
}
