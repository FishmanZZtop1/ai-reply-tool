import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. Strict Security Check: Verify the secret header to prevent unauthorized hits
    const webhookSecret = req.headers.get('x-supabase-webhook-secret');
    if (webhookSecret !== process.env.SUPABASE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized: Invalid Secret' }, { status: 401 });
    }

    // 2. Parse the Supabase Database Webhook payload
    const body = await req.json();
    
    // Supabase sends the newly inserted row inside the 'record' object
    const record = body?.record;
    const email = record?.email;

    if (!email) {
      return NextResponse.json({ error: 'Malformed payload: No email found' }, { status: 400 });
    }

    // 3. Pipe the email directly to Resend Audience
    const resendApiKey = process.env.RESEND_API_KEY;
    const audienceId = process.env.RESEND_AUDIENCE_ID;

    if (!resendApiKey || !audienceId) {
      console.error('Missing Resend environment variables.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const resendResponse = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        unsubscribed: false,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('Resend API Error:', errorText);
      return NextResponse.json({ error: 'Failed to sync with Resend' }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: 'Email captured and synced.' }, { status: 200 });

  } catch (error) {
    console.error('Webhook Fatal Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
