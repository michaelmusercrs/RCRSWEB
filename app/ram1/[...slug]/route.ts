import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(request: NextRequest) {
  // Get the full pathname from the request
  const pathname = request.nextUrl.pathname;
  
  // Default to index.html if accessing /ram1/
  let fileToServe = pathname === '/ram1' || pathname === '/ram1/' 
    ? '/ram1/index.html' 
    : pathname;
  
  // Map to the public directory
  const filePath = join(process.cwd(), 'public', fileToServe);
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    
    // Determine content type based on file extension
    let contentType = 'text/html; charset=utf-8';
    if (filePath.endsWith('.csv')) contentType = 'text/csv; charset=utf-8';
    if (filePath.endsWith('.txt')) contentType = 'text/plain; charset=utf-8';
    if (filePath.endsWith('.md')) contentType = 'text/markdown; charset=utf-8';
    if (filePath.endsWith('.json')) contentType = 'application/json';
    if (filePath.endsWith('.bin')) contentType = 'application/octet-stream';
    if (filePath.endsWith('.cds')) contentType = 'application/octet-stream';
    
    return new NextResponse(content, {
      headers: { 'Content-Type': contentType },
    });
  } catch (error) {
    // Try default index.html if file not found
    if (!fileToServe.endsWith('/index.html')) {
      try {
        const indexPath = join(process.cwd(), 'public', fileToServe, 'index.html');
        const indexContent = readFileSync(indexPath, 'utf-8');
        return new NextResponse(indexContent, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      } catch {}
    }
    
    return new NextResponse('Not Found', { status: 404 });
  }
}

export const dynamic = 'force-static';
