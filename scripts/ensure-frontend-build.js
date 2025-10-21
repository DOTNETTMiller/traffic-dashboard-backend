const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const skip = process.env.SKIP_FRONTEND_BUILD === '1';
if (skip) {
  console.log('🚫 Skipping frontend build because SKIP_FRONTEND_BUILD=1');
  process.exit(0);
}

const projectRoot = path.resolve(__dirname, '..');
const frontendDir = path.join(projectRoot, 'frontend');
const distDir = path.join(frontendDir, 'dist');

console.log('🛠️ Ensuring frontend build assets are ready...');

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
    ...options
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
};

try {
  if (!fs.existsSync(frontendDir)) {
    console.warn('⚠️ Frontend directory not found, skipping build');
    process.exit(0);
  }

  console.log('📦 Installing frontend dependencies...');
  run('npm', ['ci'], { cwd: frontendDir });

  console.log('🏗️ Building production frontend...');
  run('npm', ['run', 'build'], { cwd: frontendDir });

  if (!fs.existsSync(distDir)) {
    throw new Error('Frontend build did not produce ./frontend/dist');
  }

  console.log('✅ Frontend build complete');
} catch (error) {
  console.error('❌ Failed to build frontend:', error.message);
  process.exit(1);
}
