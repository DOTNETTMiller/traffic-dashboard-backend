import { spawn } from 'child_process';

const port = process.env.PORT || 3000;
console.log(`Starting server on port ${port}`);

const serve = spawn('npx', ['serve', 'dist', '-s', '-l', port], {
  stdio: 'inherit',
  shell: true
});

serve.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

serve.on('exit', (code) => {
  process.exit(code);
});
