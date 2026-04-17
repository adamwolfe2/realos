/**
 * Cursive (send.meetcursive.com) cold email campaign integration.
 *
 * Required env vars (set in Vercel + .env.local):
 *   CURSIVE_API_KEY     — API key from your Cursive account
 *   CURSIVE_CAMPAIGN_ID — Campaign UUID to push contacts into
 *   CURSIVE_BASE_URL    — Base URL (default: https://send.meetcursive.com)
 *
 * Cursive uses a 2-step process:
 *   1. POST /api/leads          → creates the lead, returns data.id (integer)
 *   2. POST /api/campaigns/{id}/leads/attach-leads → attaches lead to campaign
 */

export interface EmailBisonContact {
  email: string
  first_name: string
  last_name?: string
  company?: string
  website?: string
  phone?: string
  description?: string
  city?: string
}

export interface EmailBisonResult {
  id: string
  [key: string]: unknown
}

function getConfig() {
  return {
    apiKey: process.env.CURSIVE_API_KEY,
    campaignId: process.env.CURSIVE_CAMPAIGN_ID,
    baseUrl: (process.env.CURSIVE_BASE_URL || 'https://send.meetcursive.com').replace(/\/$/, ''),
  }
}

export function isConfigured(): boolean {
  const { apiKey, campaignId } = getConfig()
  return !!(apiKey && campaignId)
}

export async function pushContact(contact: EmailBisonContact): Promise<EmailBisonResult> {
  const { apiKey, campaignId, baseUrl } = getConfig()

  if (!apiKey || !campaignId) {
    throw new Error('Cursive not configured. Set CURSIVE_API_KEY and CURSIVE_CAMPAIGN_ID in Vercel env vars.')
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  // Step 1 — Create the lead
  const createRes = await fetch(`${baseUrl}/api/leads`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: contact.email,
      first_name: contact.first_name,
      last_name: contact.last_name || '',
      company: contact.company || '',
      notes: contact.description || '',
      // Non-native fields go into custom_variables
      custom_variables: [
        contact.website     && { name: 'website',     value: contact.website },
        contact.phone       && { name: 'phone',       value: contact.phone },
        contact.description && { name: 'description', value: contact.description },
        contact.city        && { name: 'city',        value: contact.city },
      ].filter(Boolean),
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (!createRes.ok) {
    const err = await createRes.text().catch(() => 'unknown')
    throw new Error(`Cursive create lead ${createRes.status}: ${err}`)
  }

  const created = await createRes.json()
  // Response shape: { data: { id: 326217, ... } }
  const leadId: number = created?.data?.id ?? created?.id
  if (!leadId) {
    throw new Error(`Cursive: no lead ID returned. Response: ${JSON.stringify(created)}`)
  }

  // Step 2 — Attach lead to campaign
  const attachRes = await fetch(
    `${baseUrl}/api/campaigns/${campaignId}/leads/attach-leads`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        lead_ids: [leadId],
        allow_parallel_sending: false,
      }),
      signal: AbortSignal.timeout(10000),
    }
  )

  if (!attachRes.ok) {
    const err = await attachRes.text().catch(() => 'unknown')
    throw new Error(`Cursive attach lead ${attachRes.status}: ${err}`)
  }

  // Return an object with string id (matches EmailBisonResult interface)
  return { id: String(leadId), leadId }
}
