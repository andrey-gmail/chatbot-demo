import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateRequest, AuthError } from '@/lib/auth-helpers';
import { uploadImage, UploadError } from '@/services/upload.service';
import type { ApiError } from '@/types/api';

export async function POST(request: NextRequest) {
  try {
    // Auth is optional — anonymous users can also upload images
    let _user;
    try {
      _user = await authenticateRequest(request);
    } catch (err) {
      // Allow anonymous uploads if there's an anonymous session cookie
      const anonSession = request.cookies.get('anonymous_session')?.value;
      if (!anonSession) {
        throw err;
      }
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      const errorResponse: ApiError = {
        error: { code: 'VALIDATION_ERROR', message: 'No image file provided' },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = createAdminClient();

    const result = await uploadImage(supabase, buffer, file.type, file.name);

    return NextResponse.json({ url: result.url, path: result.path }, { status: 201 });
  } catch (err) {
    if (err instanceof UploadError) {
      const errorResponse: ApiError = {
        error: { code: 'VALIDATION_ERROR', message: err.message },
      };
      return NextResponse.json(errorResponse, { status: err.statusCode });
    }
    if (err instanceof AuthError) {
      const errorResponse: ApiError = {
        error: { code: 'UNAUTHORIZED', message: err.message },
      };
      return NextResponse.json(errorResponse, { status: err.statusCode });
    }
    console.error('Image upload error:', err);
    const errorResponse: ApiError = {
      error: { code: 'INTERNAL_ERROR', message: 'Failed to upload image' },
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
