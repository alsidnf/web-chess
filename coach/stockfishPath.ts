import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function resolveStockfishPath(): string {
  if (process.env.STOCKFISH_PATH) {
    return process.env.STOCKFISH_PATH;
  }

  const pathCommand = process.platform === 'win32' ? 'where.exe' : 'command';
  const pathArgs = process.platform === 'win32' ? ['stockfish'] : ['-v', 'stockfish'];
  const pathResult = spawnSync(pathCommand, pathArgs, { encoding: 'utf8' });

  if (pathResult.status === 0) {
    const firstPath = pathResult.stdout.split(/\r?\n/).find((line) => line.trim());
    if (firstPath) {
      return firstPath.trim();
    }
  }

  const commonPath = findCommonWindowsInstall();
  return commonPath ?? 'stockfish';
}

function findCommonWindowsInstall(): string | undefined {
  if (process.platform !== 'win32') {
    return undefined;
  }

  const roots = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
    process.env.LOCALAPPDATA,
    process.env.USERPROFILE ? join(process.env.USERPROFILE, 'Downloads') : undefined,
    process.env.USERPROFILE ? join(process.env.USERPROFILE, 'Documents') : undefined,
    process.env.USERPROFILE ? join(process.env.USERPROFILE, 'Desktop') : undefined,
  ].filter((path): path is string => Boolean(path));

  const candidates = roots.flatMap((root) => [
    join(root, 'Stockfish', 'stockfish.exe'),
    join(root, 'stockfish', 'stockfish.exe'),
    join(root, 'stockfish.exe'),
    join(
      root,
      'Microsoft',
      'WinGet',
      'Packages',
      'Stockfish.Stockfish_Microsoft.Winget.Source_8wekyb3d8bbwe',
      'stockfish',
      'stockfish-windows-x86-64-avx2.exe',
    ),
  ]);

  return candidates.find((candidate) => existsSync(candidate));
}
