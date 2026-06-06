import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { explainBestMove, formatEvaluation } from './explainMove';
import { StockfishClient } from './stockfishClient';
import { resolveStockfishPath } from './stockfishPath';

const DEFAULT_DEPTH = 12;
const PORT = Number(process.env.COACH_PORT ?? 8787);

type AnalyzeRequest = {
  fen?: unknown;
  depth?: unknown;
};

async function main() {
  const server = createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/api/health') {
        writeJson(response, 200, {
          ok: true,
          stockfishPath: resolveStockfishPath(),
        });
        return;
      }

      if (request.method === 'POST' && request.url === '/api/analyze') {
        const body = (await readJsonBody(request)) as AnalyzeRequest;
        const fen = typeof body.fen === 'string' ? body.fen.trim() : '';
        const depth = typeof body.depth === 'number' ? body.depth : DEFAULT_DEPTH;

        if (!fen) {
          writeJson(response, 400, { error: '판 상태 코드가 비어 있습니다.' });
          return;
        }

        const result = await analyzeFen(fen, depth);
        writeJson(response, 200, result);
        return;
      }

      writeJson(response, 404, { error: '없는 주소입니다.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeJson(response, 500, { error: message });
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Stockfish coach server: http://127.0.0.1:${PORT}`);
  });
}

async function analyzeFen(fen: string, depth: number) {
  const client = new StockfishClient(resolveStockfishPath());

  try {
    await client.start();
    const analysis = await client.analyzeFen(fen, depth);
    const explanation = explainBestMove(fen, analysis.bestMove, analysis.candidates);

    return {
      bestMove: analysis.bestMove,
      candidates: analysis.candidates.map((candidate) => ({
        multipv: candidate.multipv,
        move: candidate.move,
        evaluation: candidate.evaluation,
        evaluationText: candidate.evaluation ? formatEvaluation(candidate.evaluation) : '평가 없음',
        depth: candidate.depth,
        pv: candidate.pv,
      })),
      explanation,
    };
  } finally {
    client.stop();
  }
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('요청 내용을 JSON으로 읽을 수 없습니다.'));
      }
    });
    request.on('error', reject);
  });
}

function writeJson(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(data));
}

void main();
