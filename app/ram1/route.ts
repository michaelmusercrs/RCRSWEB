import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Serve /ram1 static files directly, bypassing app routing
export async function GET(request: NextRequest, { params }: any) {
  const pathname = request.nextUrl.pathname;
  
  // Map /ram1/* to public/ram1/*
  const filePath = join(process.cwd(), 'public', pathname);
  
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
    return new NextResponse('Not Found', { status: 404 });
  }
}

export const dynamic = 'force-static';
