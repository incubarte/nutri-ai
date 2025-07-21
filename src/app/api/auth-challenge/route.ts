
import { NextResponse } from 'next/server';
import {
  createAccessRequest,
  getAccessRequest,
  approveAccessRequest,
  getRemoteAccessPassword,
  removeAccessRequest,
  getAllAccessRequests
} from '@/lib/server-side-store';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { action, requestId, selection, userAgent } = await request.json();
    const reqHeaders = headers();
    const clientIp = (reqHeaders.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();

    switch (action) {
      case 'request': {
        const newRequest = createAccessRequest(clientIp, userAgent);
        return NextResponse.json({ success: true, request: newRequest });
      }

      case 'approve': {
        if (!requestId) return NextResponse.json({ success: false, message: 'Request ID is required.' }, { status: 400 });
        const challenge = approveAccessRequest(requestId);
        if (!challenge) {
          return NextResponse.json({ success: false, message: 'Request not found or already approved.' }, { status: 404 });
        }
        return NextResponse.json({ success: true, challenge });
      }

      case 'respond': {
        if (!requestId || selection === undefined) {
          return NextResponse.json({ success: false, message: 'Request ID and selection are required.' }, { status: 400 });
        }
        const requestData = getAccessRequest(requestId);
        if (!requestData || !requestData.challenge) {
          return NextResponse.json({ success: false, message: 'Invalid or expired request.' }, { status: 404 });
        }
        if (selection === requestData.challenge.correctNumber) {
          const password = getRemoteAccessPassword();
          removeAccessRequest(requestId);
          return NextResponse.json({ success: true, authenticated: true, password });
        } else {
          removeAccessRequest(requestId); // Remove request on wrong attempt
          return NextResponse.json({ success: true, authenticated: false, message: 'Incorrect selection.' });
        }
      }
      
      case 'reject': {
         if (!requestId) return NextResponse.json({ success: false, message: 'Request ID is required.' }, { status: 400 });
         removeAccessRequest(requestId);
         return NextResponse.json({ success: true, message: 'Request rejected.' });
      }

      default:
        return NextResponse.json({ success: false, message: 'Invalid action.' }, { status: 400 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error.';
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}

export async function GET() {
    try {
        const requests = getAllAccessRequests();
        return NextResponse.json({ success: true, requests });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown server error.';
        return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
    }
}
