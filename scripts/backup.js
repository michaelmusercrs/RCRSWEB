#!/usr/bin/env node

/**
 * Automated Backup Script
 * Backs up critical data to multiple locations
 *
 * Usage: node scripts/backup.js
 * Schedule: Run daily via cron or Task Scheduler
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const DATA_DIR = path.join(__dirname, '..', 'data');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

// Files to backup
const CRITICAL_FILES = [
  'data/team-members.json',
  'lib/teamData.ts',
  'lib/blogData.ts',
  'lib/servicesData.ts',
  '.env.local',
];

// Directories to backup
const CRITICAL_DIRS = [
  'public/uploads',
  'docs',
];

async function ensureBackupDir() {
  try {
    await fs.access(BACKUP_DIR);
  } catch {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  }
}

async function createBackup() {
  console.log('🔄 Starting backup...');
  console.log(`📅 Timestamp: ${timestamp}`);

  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);
  await fs.mkdir(backupPath, { recursive: true });

  let backedUp = 0;
  let errors = 0;

  // Backup individual files
  for (const file of CRITICAL_FILES) {
    const sourcePath = path.join(__dirname, '..', file);
    const destPath = path.join(backupPath, file);

    try {
      await fs.access(sourcePath);
      const destDir = path.dirname(destPath);
      await fs.mkdir(destDir, { recursive: true });
      await fs.copyFile(sourcePath, destPath);
      console.log(`✅ Backed up: ${file}`);
      backedUp++;
    } catch (error) {
      console.error(`❌ Failed to backup ${file}:`, error.message);
      errors++;
    }
  }

  // Backup directories
  for (const dir of CRITICAL_DIRS) {
    const sourcePath = path.join(__dirname, '..', dir);
    const destPath = path.join(backupPath, dir);

    try {
      await fs.access(sourcePath);
      await fs.mkdir(destPath, { recursive: true });

      // Copy directory recursively
      await copyDir(sourcePath, destPath);
      console.log(`✅ Backed up directory: ${dir}`);
      backedUp++;
    } catch (error) {
      console.error(`❌ Failed to backup ${dir}:`, error.message);
      errors++;
    }
  }

  // Create backup manifest
  const manifest = {
    timestamp,
    date: new Date().toISOString(),
    files: CRITICAL_FILES,
    directories: CRITICAL_DIRS,
    backedUp,
    errors,
    size: await getDirectorySize(backupPath),
  };

  await fs.writeFile(
    path.join(backupPath, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('');
  console.log('📊 Backup Summary:');
  console.log(`   ✅ Successful: ${backedUp}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📦 Size: ${formatBytes(manifest.size)}`);
  console.log(`   📁 Location: ${backupPath}`);

  return { backupPath, manifest };
}

async function copyDir(src, dest) {
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function getDirectorySize(dir) {
  let size = 0;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        size += await getDirectorySize(fullPath);
      } else {
        const stats = await fs.stat(fullPath);
        size += stats.size;
      }
    }
  } catch {
    // Ignore errors
  }

  return size;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

async function cleanOldBackups(daysToKeep = 30) {
  console.log('');
  console.log('🧹 Cleaning old backups...');

  try {
    const backups = await fs.readdir(BACKUP_DIR);
    const now = Date.now();
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

    let deleted = 0;

    for (const backup of backups) {
      const backupPath = path.join(BACKUP_DIR, backup);
      const stats = await fs.stat(backupPath);

      if (stats.isDirectory() && now - stats.mtimeMs > maxAge) {
        await fs.rm(backupPath, { recursive: true, force: true });
        console.log(`🗑️  Deleted old backup: ${backup}`);
        deleted++;
      }
    }

    console.log(`✅ Deleted ${deleted} old backups (older than ${daysToKeep} days)`);
  } catch (error) {
    console.error('❌ Error cleaning old backups:', error.message);
  }
}

async function createGitBackup() {
  console.log('');
  console.log('📦 Creating Git backup...');

  try {
    // Check if git is available
    execSync('git --version', { stdio: 'ignore' });

    // Stage all changes
    execSync('git add .', { stdio: 'ignore' });

    // Commit with timestamp
    const commitMessage = `Automated backup - ${new Date().toISOString()}`;
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'ignore' });

    console.log('✅ Git backup created');
  } catch (error) {
    // Git may not be initialized or no changes to commit
    console.log('ℹ️  Git backup skipped (no changes or git not configured)');
  }
}

// Main execution
async function main() {
  try {
    await ensureBackupDir();
    const { backupPath, manifest } = await createBackup();
    await cleanOldBackups(30); // Keep last 30 days
    await createGitBackup();

    console.log('');
    console.log('✅ Backup completed successfully!');
    console.log('');

    // Optional: Upload to cloud storage
    // await uploadToCloud(backupPath);

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { createBackup, cleanOldBackups };
