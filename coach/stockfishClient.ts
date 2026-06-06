import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { access } from 'node:fs/promises';

export type EngineEvaluation =
  | { type: 'cp'; value: number }
  | { type: 'mate'; value: number };

export type CandidateMove = {
  multipv: number;
  move: string;
  evaluation?: EngineEvaluation;
  depth?: number;
  pv: string[];
};

export type AnalysisResult = {
  bestMove: string;
  candidates: CandidateMove[];
};

type PendingWait = {
  predicate: (line: string) => boolean;
  resolve: (line: string) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export class StockfishClient {
  private process?: ChildProcessWithoutNullStreams;
  private readonly pending: PendingWait[] = [];
  private readonly candidates = new Map<number, CandidateMove>();

  constructor(private readonly executablePath: string) {}

  async start(): Promise<void> {
    await ensureExecutableExists(this.executablePath);

    this.process = spawn(this.executablePath, [], { stdio: 'pipe' });
    this.process.stdout.setEncoding('utf8');
    this.process.stderr.setEncoding('utf8');
    this.process.stdout.on('data', (chunk: string) => this.handleOutput(chunk));
    this.process.stderr.on('data', (chunk: string) => {
      const message = chunk.trim();
      if (message) {
        console.error(`[stockfish] ${message}`);
      }
    });
    this.process.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        this.rejectAll(
          new Error(
            'Stockfish를 찾지 못했습니다. Stockfish를 설치한 뒤 PATH에 추가하거나 STOCKFISH_PATH에 실행 파일 전체 경로를 지정해 주세요.',
          ),
        );
        return;
      }

      this.rejectAll(error);
    });
    this.process.on('exit', (code) => {
      if (code !== 0) {
        this.rejectAll(new Error(`Stockfish exited with code ${code ?? 'unknown'}.`));
      }
    });

    this.send('uci');
    await this.waitForLine((line) => line === 'uciok', 8_000);
    this.send('isready');
    await this.waitForLine((line) => line === 'readyok', 8_000);
    this.send('setoption name MultiPV value 3');
    this.send('isready');
    await this.waitForLine((line) => line === 'readyok', 8_000);
  }

  async analyzeFen(fen: string, depth = 12): Promise<AnalysisResult> {
    if (!this.process) {
      throw new Error('Stockfish has not been started.');
    }

    this.candidates.clear();
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);

    const bestMoveLine = await this.waitForLine((line) => line.startsWith('bestmove '), 30_000);
    const bestMove = bestMoveLine.split(/\s+/)[1];
    if (!bestMove || bestMove === '(none)') {
      throw new Error('Stockfish did not return a legal best move for this position.');
    }

    const candidates = [...this.candidates.values()]
      .sort((a, b) => a.multipv - b.multipv)
      .slice(0, 3);

    return { bestMove, candidates };
  }

  stop(): void {
    if (this.process) {
      this.send('quit');
      this.process.kill();
      this.process = undefined;
    }
  }

  private send(command: string): void {
    this.process?.stdin.write(`${command}\n`);
  }

  private handleOutput(chunk: string): void {
    for (const line of chunk.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      this.recordCandidate(trimmed);
      const waiterIndex = this.pending.findIndex((waiter) => waiter.predicate(trimmed));
      if (waiterIndex >= 0) {
        const [waiter] = this.pending.splice(waiterIndex, 1);
        clearTimeout(waiter.timeout);
        waiter.resolve(trimmed);
      }
    }
  }

  private recordCandidate(line: string): void {
    if (!line.startsWith('info ') || !line.includes(' pv ')) {
      return;
    }

    const tokens = line.split(/\s+/);
    const multipvIndex = tokens.indexOf('multipv');
    const pvIndex = tokens.indexOf('pv');
    const scoreIndex = tokens.indexOf('score');
    const depthIndex = tokens.indexOf('depth');
    const multipv = multipvIndex >= 0 ? Number(tokens[multipvIndex + 1]) : 1;
    const firstMove = tokens[pvIndex + 1];

    if (!Number.isFinite(multipv) || !firstMove) {
      return;
    }

    const evaluation = parseEvaluation(tokens, scoreIndex);
    const depth = depthIndex >= 0 ? Number(tokens[depthIndex + 1]) : undefined;

    this.candidates.set(multipv, {
      multipv,
      move: firstMove,
      evaluation,
      depth: Number.isFinite(depth) ? depth : undefined,
      pv: tokens.slice(pvIndex + 1),
    });
  }

  private waitForLine(predicate: (line: string) => boolean, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.pending.findIndex((waiter) => waiter.resolve === resolve);
        if (index >= 0) {
          this.pending.splice(index, 1);
        }
        reject(new Error(`Timed out while waiting for Stockfish after ${timeoutMs}ms.`));
      }, timeoutMs);

      this.pending.push({ predicate, resolve, reject, timeout });
    });
  }

  private rejectAll(error: Error): void {
    while (this.pending.length > 0) {
      const waiter = this.pending.shift();
      if (waiter) {
        clearTimeout(waiter.timeout);
        waiter.reject(error);
      }
    }
  }
}

function parseEvaluation(tokens: string[], scoreIndex: number): EngineEvaluation | undefined {
  if (scoreIndex < 0) {
    return undefined;
  }

  const type = tokens[scoreIndex + 1];
  const value = Number(tokens[scoreIndex + 2]);
  if (!Number.isFinite(value)) {
    return undefined;
  }

  if (type === 'cp') {
    return { type, value };
  }

  if (type === 'mate') {
    return { type, value };
  }

  return undefined;
}

async function ensureExecutableExists(executablePath: string): Promise<void> {
  if (executablePath === 'stockfish') {
    return;
  }

  try {
    await access(executablePath);
  } catch {
    throw new Error(
      `"${executablePath}" 위치에서 Stockfish 실행 파일을 찾지 못했습니다. STOCKFISH_PATH를 전체 경로로 지정하거나 stockfish 명령이 PATH에서 실행되게 해 주세요.`,
    );
  }
}
