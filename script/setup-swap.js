import { execSync } from 'child_process';
import fs from 'fs';

// Only run on Linux/Render
if (process.platform !== 'linux') {
  console.log('Not running on Linux, skipping swap setup.');
  process.exit(0);
}

try {
  // Check if swap is already active
  const swapInfo = fs.readFileSync('/proc/swaps', 'utf-8');
  if (swapInfo.includes('/tmp/swapfile')) {
    console.log('Swap already enabled.');
    process.exit(0);
  }

  console.log('Setting up 512MB swap file...');
  
  // Create swap file in /tmp (usually writable on Render)
  execSync('fallocate -l 512M /tmp/swapfile || dd if=/dev/zero of=/tmp/swapfile bs=1M count=512');
  execSync('chmod 0600 /tmp/swapfile');
  execSync('mkswap /tmp/swapfile');
  execSync('swapon /tmp/swapfile');
  
  console.log('Swap enabled successfully!');
  console.log(execSync('free -h').toString());
} catch (error) {
  console.error('Failed to setup swap:', error.message);
  // Don't fail the build/start, just log it
}
