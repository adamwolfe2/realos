import { NextRequest, NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { uploadFile, UploadError } from "@/lib/uploads";

// POST /api/tenant/uploads
// Stores uploaded files under an org-scoped prefix in Vercel Blob so we
// never mix assets across tenants. Returns the public URL.
export async function POST(req: NextRequest) {
  try {
    const scope = await requireScope();
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }
    const prefix = `tenant/${scope.orgId}`;
    const result = await uploadFile(file, prefix);
    return NextResponse.json({ url: result.url, pathname: result.pathname });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof UploadError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
