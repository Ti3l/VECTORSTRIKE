import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Inicia ambos os processos diretamente com Node, sem shell. No Windows,
// evita que "C:\\Program Files\\nodejs\\node.exe" seja interpretado como
// "C:\\Program" quando o Node esta instalado em um caminho com espacos.
const root = fileURLToPath(new URL('../', import.meta.url));
const serverEntry = fileURLToPath(new URL('../server/index.js', import.meta.url));
const viteEntry = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const children = [];
let stopping = false;

function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill();
  }
  process.exitCode = exitCode;
}

function launch(label, script, args = []) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    windowsHide: false,
  });
  children.push(child);
  child.on('error', (err) => {
    console.error(`[${label}] Nao foi possivel iniciar:`, err.message);
    shutdown(1);
  });
  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.error(`[${label}] Processo finalizado (${signal ?? code ?? 'desconhecido'}).`);
    shutdown(code || 1);
  });
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

launch('Servidor multiplayer', serverEntry);
launch('Vite', viteEntry, ['--host', '0.0.0.0']);
