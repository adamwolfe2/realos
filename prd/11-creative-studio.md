# Sprint 11 — Ad Creative Studio (Request/Fulfill Workflow)

**Duration:** 0.5 day
**Dependencies:** Sprint 05
**Goal:** Clients submit ad creative requests with reference images, brand assets, and copy ideas. Agency fulfills them manually, delivers assets back, approval flow logs revisions. No AI image generation in v1.

---

## Scope clarification

This is a structured request/delivery workflow, not an AI creative tool. Think of it as a Linear/Asana board specifically for creative requests, with:

- Client-side form for submitting requests
- Agency-side queue for fulfillment
- Threaded conversation between client and agency
- File upload for reference images (client) and deliverables (agency)
- Approval/revision workflow

Future v2 can layer AI generation (Flux Kontext, Nano Banana, etc.) as a speed-up for the agency side.

---

## Step-by-step

### 1. Client-side: new request form

```tsx
// app/portal/creative/new/page.tsx
import { requireClient } from "@/lib/tenancy/scope";
import { CreativeRequestForm } from "@/components/creative-request/new-form";
import { prisma } from "@/lib/db";

export default async function NewCreativeRequest() {
  const scope = await requireClient();
  const properties = await prisma.property.findMany({ where: { orgId: scope.orgId } });
  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">New creative request</h1>
      <CreativeRequestForm properties={properties} />
    </div>
  );
}
```

```tsx
// components/creative-request/new-form.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const FORMATS = [
  { key: "INSTAGRAM_STORY", label: "Instagram Story (9:16)" },
  { key: "INSTAGRAM_FEED", label: "Instagram Feed (1:1)" },
  { key: "FACEBOOK_FEED", label: "Facebook Feed (1.91:1)" },
  { key: "GOOGLE_DISPLAY", label: "Google Display (various)" },
  { key: "GOOGLE_SEARCH_COPY", label: "Google Search ad copy" },
  { key: "EMAIL_HEADER", label: "Email header image" },
  { key: "WEB_BANNER", label: "Website banner" },
  { key: "PRINT_FLYER", label: "Print flyer" },
  { key: "OTHER", label: "Other" },
];

export function CreativeRequestForm({ properties }: { properties: any[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [refUrls, setRefUrls] = useState<string[]>([]);
  const [brandUrls, setBrandUrls] = useState<string[]>([]);

  async function handleUpload(files: FileList, kind: "reference" | "brand") {
    // Upload to Vercel Blob via signed URL
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/tenant/uploads", { method: "POST", body: fd });
      const { url } = await res.json();
      uploaded.push(url);
    }
    if (kind === "reference") setRefUrls(prev => [...prev, ...uploaded]);
    else setBrandUrls(prev => [...prev, ...uploaded]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      propertyId: fd.get("propertyId") || null,
      title: fd.get("title"),
      description: fd.get("description"),
      format: fd.get("format"),
      targetDate: fd.get("targetDate") || null,
      copyIdeas: fd.get("copyIdeas"),
      targetAudience: fd.get("targetAudience"),
      referenceImageUrls: refUrls,
      brandAssetsUrls: brandUrls,
    };
    const res = await fetch("/api/tenant/creative-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const { id } = await res.json();
    router.push(`/portal/creative/${id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <select name="propertyId" className="w-full border p-3 rounded">
        <option value="">For all properties</option>
        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <input name="title" placeholder="Title (e.g. Fall 2026 move-in push)" required className="w-full border p-3 rounded" />

      <select name="format" required className="w-full border p-3 rounded">
        <option value="">Format...</option>
        {FORMATS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>

      <input name="targetDate" type="date" className="w-full border p-3 rounded" />

      <textarea name="description" placeholder="Describe what you want" required rows={4} className="w-full border p-3 rounded" />
      <textarea name="copyIdeas" placeholder="Copy ideas (headlines, taglines)" rows={3} className="w-full border p-3 rounded" />
      <textarea name="targetAudience" placeholder="Who is this for?" rows={2} className="w-full border p-3 rounded" />

      <div>
        <label className="block text-sm font-semibold mb-1">Reference images (inspiration)</label>
        <input type="file" multiple accept="image/*" onChange={e => e.target.files && handleUpload(e.target.files, "reference")} />
        <div className="flex gap-2 mt-2 flex-wrap">
          {refUrls.map(u => <img key={u} src={u} className="w-20 h-20 object-cover rounded" />)}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Brand assets (logos, brand photos)</label>
        <input type="file" multiple accept="image/*" onChange={e => e.target.files && handleUpload(e.target.files, "brand")} />
        <div className="flex gap-2 mt-2 flex-wrap">
          {brandUrls.map(u => <img key={u} src={u} className="w-20 h-20 object-cover rounded" />)}
        </div>
      </div>

      <button type="submit" disabled={submitting} className="w-full py-3 bg-[var(--brand-primary)] text-white rounded font-semibold">
        {submitting ? "Submitting..." : "Submit request"}
      </button>
    </form>
  );
}
```

### 2. File upload endpoint

```typescript
// app/api/tenant/uploads/route.ts
import { requireClient } from "@/lib/tenancy/scope";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const scope = await requireClient();
  const fd = await req.formData();
  const file = fd.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const path = `org-${scope.orgId}/${Date.now()}-${file.name}`;
  const blob = await put(path, file, { access: "public" });
  return NextResponse.json({ url: blob.url });
}
```

### 3. Create request API

```typescript
// app/api/tenant/creative-requests/route.ts
import { requireClient } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { sendSlackAlert } from "@/lib/integrations/slack";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const scope = await requireClient();
  const body = await req.json();

  const request = await prisma.creativeRequest.create({
    data: {
      orgId: scope.orgId,
      propertyId: body.propertyId || null,
      requestedByUserId: scope.userId,
      title: body.title,
      description: body.description,
      format: body.format,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
      referenceImageUrls: body.referenceImageUrls ?? [],
      brandAssetsUrls: body.brandAssetsUrls ?? [],
      copyIdeas: body.copyIdeas,
      targetAudience: body.targetAudience,
      messages: [],
      status: "SUBMITTED",
    },
  });

  const org = await prisma.organization.findUnique({ where: { id: scope.orgId } });
  await sendSlackAlert({
    channel: "#creative-requests",
    message: `New creative request from *${org?.name}*: "${request.title}" (${request.format}). ${request.targetDate ? `Needed by ${request.targetDate.toDateString()}.` : ""}`,
  });

  return NextResponse.json({ id: request.id });
}

export async function GET() {
  const scope = await requireClient();
  const requests = await prisma.creativeRequest.findMany({
    where: { orgId: scope.orgId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ requests });
}
```

### 4. Request detail + conversation

`app/portal/creative/[id]/page.tsx`:

```tsx
import { requireClient } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { CreativeRequestThread } from "@/components/creative-request/thread";

export default async function CreativeRequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const scope = await requireClient();
  const { id } = await params;
  const request = await prisma.creativeRequest.findFirst({
    where: { id, orgId: scope.orgId },
  });
  if (!request) return <div>Not found</div>;
  return <CreativeRequestThread request={request} viewer="client" />;
}
```

`components/creative-request/thread.tsx`:

```tsx
"use client";
import { useState } from "react";

export function CreativeRequestThread({ request, viewer }: { request: any; viewer: "client" | "agency" }) {
  const [reply, setReply] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);

  async function sendMessage() {
    await fetch(`/api/tenant/creative-requests/${request.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: reply, attachmentUrls: attachments }),
    });
    window.location.reload();
  }

  async function requestRevision() {
    await fetch(`/api/tenant/creative-requests/${request.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REVISION_REQUESTED" }),
    });
    window.location.reload();
  }

  async function approve() {
    await fetch(`/api/tenant/creative-requests/${request.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    window.location.reload();
  }

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{request.title}</h1>
        <div className="text-sm text-muted-foreground">{request.format} · {request.status}</div>
        <p className="mt-4 whitespace-pre-wrap">{request.description}</p>
        {request.copyIdeas && <p className="mt-2"><strong>Copy ideas:</strong> {request.copyIdeas}</p>}
        {request.targetAudience && <p className="mt-2"><strong>Audience:</strong> {request.targetAudience}</p>}
      </div>

      {request.referenceImageUrls?.length > 0 && (
        <div>
          <h3 className="font-semibold">Reference images</h3>
          <div className="flex gap-2 mt-2 flex-wrap">
            {(request.referenceImageUrls as string[]).map(u => <img key={u} src={u} className="w-32 h-32 object-cover rounded" />)}
          </div>
        </div>
      )}

      {request.deliverableUrls?.length > 0 && (
        <div>
          <h3 className="font-semibold">Deliverables</h3>
          <div className="flex gap-2 mt-2 flex-wrap">
            {(request.deliverableUrls as string[]).map(u => <img key={u} src={u} className="w-40 h-40 object-cover rounded" />)}
          </div>
          {viewer === "client" && request.status === "DELIVERED" && (
            <div className="flex gap-2 mt-4">
              <button onClick={approve} className="px-4 py-2 bg-green-600 text-white rounded">Approve</button>
              <button onClick={requestRevision} className="px-4 py-2 border rounded">Request revision</button>
            </div>
          )}
        </div>
      )}

      <div className="border-t pt-4">
        <h3 className="font-semibold mb-2">Conversation</h3>
        <div className="space-y-3">
          {(request.messages as any[] ?? []).map((m, i) => (
            <div key={i} className={`p-3 rounded ${m.from === viewer ? "bg-gray-100 ml-12" : "bg-blue-50 mr-12"}`}>
              <div className="text-xs text-muted-foreground">{m.role} · {new Date(m.timestamp).toLocaleString()}</div>
              <div>{m.content}</div>
              {m.attachmentUrls?.map((u: string) => <img key={u} src={u} className="mt-2 w-32 h-32 object-cover rounded" />)}
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3} placeholder="Add a note or question..." className="w-full border p-3 rounded" />
          <button onClick={sendMessage} className="px-4 py-2 bg-[var(--brand-primary)] text-white rounded">Send</button>
        </div>
      </div>
    </div>
  );
}
```

### 5. Message API

```typescript
// app/api/tenant/creative-requests/[id]/messages/route.ts
import { requireClient } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const scope = await requireClient();
  const { id } = await params;
  const body = await req.json();

  const current = await prisma.creativeRequest.findFirst({
    where: { id, orgId: scope.orgId },
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = (current.messages as any[]) ?? [];
  messages.push({
    role: scope.isAgency ? "agency" : "client",
    from: scope.isAgency ? "agency" : "client",
    content: body.content,
    attachmentUrls: body.attachmentUrls ?? [],
    timestamp: new Date().toISOString(),
    userId: scope.userId,
  });

  await prisma.creativeRequest.update({
    where: { id },
    data: {
      messages,
      status: current.status === "SUBMITTED" && scope.isAgency ? "IN_REVIEW" : current.status,
    },
  });

  return NextResponse.json({ ok: true });
}
```

### 6. Status update API

```typescript
// app/api/tenant/creative-requests/[id]/status/route.ts
import { requireClient } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const scope = await requireClient();
  const { id } = await params;
  const body = await req.json();

  const updates: any = { status: body.status };
  if (body.status === "DELIVERED") updates.deliveredAt = new Date();
  if (body.status === "APPROVED") updates.approvedAt = new Date();
  if (body.status === "REVISION_REQUESTED") updates.revisionCount = { increment: 1 };
  if (body.deliverableUrls) updates.deliverableUrls = body.deliverableUrls;

  await prisma.creativeRequest.update({
    where: { id, orgId: scope.orgId },
    data: updates,
  });

  return NextResponse.json({ ok: true });
}
```

### 7. Agency queue view

`app/admin/creative-requests/page.tsx` — Kanban by status: Submitted | In Review | In Progress | Revision Requested | Delivered | Approved. Agency drags cards between columns. Detail page reuses the thread component with `viewer="agency"` and adds "Upload deliverables" button.

### 8. Notifications

- Slack alert on new request → `#creative-requests` channel
- Email to agency team on new request
- Email to client on status change to `DELIVERED`
- Email to agency on client response / revision request

### 9. Optional: AI pre-draft (stubbed for v2)

In v2, add "Generate draft" button on agency side that uses Claude to draft copy and FAL (Flux Kontext) to generate a first-pass image. Store that as the initial deliverable, agency edits as needed. For v1, purely manual.

---

## Done when

- [ ] Client submits request with images and copy ideas
- [ ] Request lands in agency queue with Slack notification
- [ ] Back-and-forth conversation thread works both directions
- [ ] Agency uploads deliverables, client approves or requests revisions
- [ ] Revision count increments correctly
- [ ] Approved requests are archived (filter in queue by default excludes them)
- [ ] All files scoped to org (no cross-tenant leakage)

## Handoff to Sprint 12
All client-facing features are built. Sprint 12 ships the platform marketing site that sells this entire product to new real estate operators.
