import type { CoachAnalysis } from '../lib/coachApi';

type CoachPanelProps = {
  analysis: CoachAnalysis | null;
  error: string | null;
  isLoading: boolean;
  onAnalyzeNow: () => void;
};

export function CoachPanel({ analysis, error, isLoading, onAnalyzeNow }: CoachPanelProps) {
  return (
    <section className="coachPanel">
      <div className="sectionHeader">
        <div>
          <h2>Stockfish 코치</h2>
          <p className="sectionHelp">현재 판을 자동으로 읽어서 추천 수를 보여줍니다.</p>
        </div>
        <button type="button" onClick={onAnalyzeNow} disabled={isLoading}>
          다시 분석
        </button>
      </div>

      {isLoading ? <p className="coachState">Stockfish가 생각하는 중입니다...</p> : null}

      {error ? <p className="coachError">{error}</p> : null}

      {!isLoading && !error && !analysis ? (
        <p className="coachState">수 두면 자동으로 분석을 시작합니다.</p>
      ) : null}

      {analysis ? (
        <div className="coachResult">
          <div>
            <span>추천 수</span>
            <strong>{analysis.bestMove}</strong>
            <p className="sectionHelp">체스판 위 보라색 화살표가 추천 이동입니다.</p>
          </div>

          <ul className="candidateList">
            {analysis.candidates.map((candidate) => (
              <li key={`${candidate.multipv}-${candidate.move}`}>
                <strong>{candidate.multipv}순위</strong>
                <span>{candidate.move}</span>
                <em>
                  {candidate.evaluationText}
                  {candidate.depth ? `, 깊이 ${candidate.depth}` : ''}
                </em>
              </li>
            ))}
          </ul>

          <div className="explanationBox">
            <p>{analysis.explanation.moveText}</p>
            <p>{analysis.explanation.reason}</p>
            <p>{analysis.explanation.safety}</p>
            <p>{analysis.explanation.beginnerTip}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
