import { NextResponse } from 'next/server';

// Catch-all handler for unmatched API routes — returns JSON 404 instead of HTML
function notFound(request: Request) {
  const url = new URL(request.url);
  return NextResponse.json(
    {
      error: 'Not Found',
      message: `API route ${url.pathname} does not exist`,
      status: 404,
    },
    { status: 404 }
  );
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const DELETE = notFound;
export const PATCH = notFound;
