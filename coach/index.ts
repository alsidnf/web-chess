import { createInterface } from 'node:readline/promises';
import { readFileSync } from 'node:fs';
import { stdin, stdout } from 'node:process';
import { explainBestMove, formatEvaluation } from './explainMove';
import { extractFen } from './fenParser';
import { StockfishClient } from './stockfishClient';
import { resolveStockfishPath } from './stockfishPath';

const DEFAULT_DEPTH = 12;

async function main() {
  const readline = stdin.isTTY ? createInterface({ input: stdin, output: stdout }) : undefined;

  try {
    const rawInput = await readCoachInput(readline);
    const fen = extractFen(rawInput);

    const stockfishPath = resolveStockfishPath();
    const client = new StockfishClient(stockfishPath);

    try {
      console.log(`\n찾은 판 상태 코드: ${fen}`);
      console.log(`Stockfish로 ${DEFAULT_DEPTH}수 깊이까지 분석합니다...`);
      await client.start();
      const result = await client.analyzeFen(fen, DEFAULT_DEPTH);
      const explanation = explainBestMove(fen, result.bestMove, result.candidates);

      console.log('\n추천 수');
      console.log(`- ${result.bestMove}`);

      if (result.candidates.length > 0) {
        console.log('\n후보 수');
        for (const candidate of result.candidates) {
          const score = candidate.evaluation ? formatEvaluation(candidate.evaluation) : '평가 없음';
          const depth = candidate.depth ? `깊이 ${candidate.depth}` : '깊이 알 수 없음';
          console.log(`- ${candidate.multipv}순위: ${candidate.move} (${score}, ${depth})`);
        }
      }

      console.log('\n초보자용 설명');
      console.log(`- ${explanation.moveText}`);
      console.log(`- ${explanation.reason}`);
      console.log(`- ${explanation.safety}`);
      console.log(`- ${explanation.beginnerTip}`);
    } finally {
      client.stop();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n코치 오류: ${message}`);
    console.error(
      '도움말: Stockfish를 설치한 뒤 STOCKFISH_PATH에 실행 파일 경로를 지정하거나, stockfish 명령이 PATH에서 실행되게 해 주세요.',
    );
    process.exitCode = 1;
  } finally {
    readline?.close();
  }
}

async function readCoachInput(readline?: ReturnType<typeof createInterface>): Promise<string> {
  if (process.argv.length > 2) {
    return process.argv.slice(2).join(' ');
  }

  if (!stdin.isTTY) {
    return readFileSync(0, 'utf8');
  }

  if (!readline) {
    throw new Error('입력을 읽을 수 없습니다.');
  }

  return readline.question(
    '웹앱의 "판 상태 코드"를 붙여넣어 주세요. 주변 문장이 섞여 있어도 자동으로 찾습니다: ',
  );
}

void main();
