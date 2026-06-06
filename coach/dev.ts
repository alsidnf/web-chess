import { spawn } from 'node:child_process';

const commands = [
  ['tsx', ['coach/server.ts']],
  ['vite', ['--host', '127.0.0.1', '--port', '5173']],
] as const;

const children = commands.map(([command, args]) =>
  spawn(command, args, {
    shell: true,
    stdio: 'inherit',
  }),
);

for (const child of children) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      for (const processToStop of children) {
        processToStop.kill();
      }
      process.exitCode = code;
    }
  });
}

function stopChildren() {
  for (const child of children) {
    child.kill();
  }
}

process.on('SIGINT', stopChildren);
process.on('SIGTERM', stopChildren);
