
import { NextResponse } from 'next/server';
import { triggerManualSync } from '@/lib/sync-process';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Ensure this is only run when the feature is enabled
  if (process.env.STORAGE_PROVIDER !== 'googledrive_override') {
    return NextResponse.json(
      { message: "Manual sync is only available for 'googledrive_override' storage provider." },
      { status: 400 }
    );
  }

  const result = await triggerManualSync();
  
  return NextResponse.json(result);
}
