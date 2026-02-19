// Check if the page chunk has any module resolution issues
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Check the webpack chunk for the present page
const chunkDir = '.next/static/chunks/app/command-center/meetings/present';
try {
  const files = readdirSync(chunkDir);
  console.log('Chunk files:', files);
} catch(e) {
  console.log('No chunk dir found');
}

// Check if there are any webpack errors in the build output
const pageChunkPath = '.next/static/chunks/app/command-center/meetings/present/page.js';
try {
  const content = readFileSync(pageChunkPath, 'utf8');
  // Look for module not found or error patterns
  const lines = content.split('\n');
  console.log('Page chunk lines:', lines.length);
  console.log('Page chunk size:', content.length);
  
  // Check for __webpack_require__ calls and look for missing modules
  const requireCalls = content.match(/__webpack_require__\([^)]+\)/g);
  if (requireCalls) {
    console.log('Total webpack require calls:', requireCalls.length);
  }
  
  // Look for "Cannot find module" or similar
  if (content.includes('Cannot find module')) {
    console.log('WARNING: Contains "Cannot find module"');
  }
  
  // Check for the SalesCompetition import specifically
  if (content.includes('SalesCompetition')) {
    console.log('SalesCompetition IS referenced in chunk');
  } else {
    console.log('WARNING: SalesCompetition NOT found in chunk');
  }
  
  // Check for styled-jsx
  if (content.includes('styled-jsx')) {
    console.log('styled-jsx IS referenced in chunk');
  } else {
    console.log('WARNING: styled-jsx NOT found in chunk');
  }
  
} catch(e) {
  console.log('Error reading page chunk:', e.message);
}
