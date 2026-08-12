# Chatbot Recursive Learning + Follow-Up Tasks Design

Date: 2026-08-11

## Goal

Make the LeaseStack chatbot learn from real lead outcomes and turn abandoned or stalled conversations into drafted follow-ups and recommended leasing-team tasks.

This is a core product loop, not an extra feature:

1. The chatbot talks to prospects.
2. LeaseStack observes what happened next.
3. The system identifies where the conversation stalled.
4. It drafts a better follow-up or a knowledge-base improvement.
5. The leasing team approves, edits, sends, or dismisses.
6. Those operator decisions become training signal for the next draft.

First rule: do not auto-send follow-ups in the first version. Generate drafts and tasks. Operators stay in control until enough trust and audit history exists.

## Telegraph Commons Findings

Data reviewed from the real SG Real Estate / Telegraph Commons production workspace, aggregated only. No raw lead names, emails, phone numbers, or transcript excerpts were copied into this memo.

### Chatbot Volume

- 209 chatbot conversations since April 20, 2026.
- 205 are attributed to Telegraph Commons.
- 101 conversations captured a contact method or linked lead.
- 48.3% overall capture rate.
- 94 conversations had 3+ messages, meaning the prospect engaged beyond a drive-by question.
- Average conversation depth: 5.0 messages.

### Lead Outcomes

Chatbot-origin leads:

- 71 still `NEW`.
- 13 reached `APPLIED`.
- 4 reached `SIGNED`.
- Average score for `NEW` chatbot leads: 38.3.
- 35 of the `NEW` chatbot leads are already marked warm.

The strongest gap is operational. LeaseStack is capturing interest, but many chatbot leads are not being moved into a next step.

### Prospect Profile Signal

- 133 conversations have extracted prospect profiles.
- 132 have a non-empty `followUpNeeded` signal.
- 79 are warm/hot.
- 133 have move-in timing captured.
- 133 have budget intent captured.

Follow-up categories from extracted profiles:

- 59 need availability/pricing follow-up.
- 35 need tour/visit scheduling.
- 21 need general human follow-up.
- 11 need application/lease help.
- 6 need other follow-up.
- 1 needed no follow-up.

Move-in timing:

- 47 are August/fall.
- 7 are summer.
- 6 are other dated timing.
- 2 are ASAP/now.
- 71 are blank in the profile field.

Budget parsing was sparse but useful where clean:

- 18 clean budget values parsed.
- Median parsed budget: about $995.
- Parsed range: $765-$2,000.

### Drop-Off Pattern

The most important behavioral gap is the 3-6 message segment:

- 46 conversations reached 3-6 messages.
- Only 7 captured contact info.
- 35 still had follow-up-needed signal.

That means the bot learned enough to know what the prospect wanted, but did not reliably convert the exchange into a concrete next step.

Opening intent was concentrated:

- Pricing/budget: 90 conversations, 26 captured.
- Availability/unit type: 59 conversations, 23 captured.
- Tour scheduling: 9 conversations, 1 captured.

Assistant resolution pattern:

- "Sent to availability/site": 75 conversations, 38 captured.
- "Sent to human contact": 66 conversations, 11 captured.
- "No clear CTA": 12 conversations, 1 captured.
- "Application CTA": 4 conversations, 0 captured.
- "Tour CTA": 1 conversation, 0 captured.

The bot performs better when it gives a concrete availability/site path. It performs poorly when it punts to human contact without capturing, scheduling, or drafting the handoff.

### Human Response Data Gap

Inside LeaseStack for SG:

- 2 lead-interaction notes.
- 0 logged in-app lead emails.
- 0 logged in-app lead SMS messages.
- 3 lead audit events.

So recursive learning cannot yet rely on "what did the leasing team actually write back?" inside the app. The first version must learn from outcomes and future operator edits to AI drafts.

## Product Thesis

LeaseStack should treat every chatbot conversation as a case file:

- what did the prospect ask,
- what did the bot answer,
- did the bot capture contact info,
- did the prospect become a lead,
- did they tour/apply/sign,
- what should have happened next,
- what should the bot learn before the next similar prospect appears.

The UI output should be simple:

- "Follow up with this lead."
- "Here is the drafted SMS/email."
- "Here is why."
- "Here is what the chatbot should learn."

## Recommended Approach

Build a **Conversation Learning Loop** with three connected outputs:

1. **Lead Follow-Up Tasks**
   Recommended leasing-team tasks created from stalled chatbot conversations and downstream outcome gaps.

2. **Drafted Follow-Ups**
   AI-generated email/SMS drafts grounded in the transcript, prospect profile, property data, and the desired next step.

3. **Chatbot Knowledge Improvements**
   Suggested knowledge-base updates when repeated drop-offs come from missing answers, weak CTAs, or generic leasing-office handoffs.

This should plug into the chatbot-first onboarding and Leasing Action Center spec. It is part of the core product spine.

## Alternatives Considered

### A. Only Improve the Chatbot Prompt

Useful but incomplete. A better prompt may reduce future drop-off, but it does nothing for the 71 existing `NEW` chatbot leads at SG.

### B. Auto-Send AI Follow-Ups

High leverage but too risky for v1. Leasing communication has compliance, timing, tone, and wrong-recipient risk. Start with approval-required drafts.

### C. Draft + Task + Learn

Recommended. It creates value immediately, keeps humans in control, and captures feedback for recursive improvement.

## Core Concepts

### Learning Case

A learning case is a snapshot generated from one conversation or one cohort pattern.

Case types:

- `stalled_lead`
- `uncaptured_engaged_conversation`
- `tour_intent_no_tour`
- `pricing_question_no_capture`
- `availability_question_no_capture`
- `application_help_needed`
- `signed_pattern`
- `lost_pattern`
- `bot_fallback_pattern`

Each case stores:

- org/property/lead/conversation references,
- observed transcript signals,
- prospect profile summary,
- downstream outcome,
- recommended next step,
- confidence,
- generated draft IDs,
- operator disposition.

### Follow-Up Task

A follow-up task is the operator-facing work item.

Examples:

- "Send availability/pricing follow-up."
- "Invite to schedule a tour."
- "Help with application next step."
- "Ask if they are still looking for August move-in."
- "Confirm preferred room type."

Each task includes:

- lead/conversation link,
- reason,
- recommended channel,
- urgency,
- draft message,
- status: `open`, `approved`, `sent`, `edited_sent`, `dismissed`, `snoozed`.

### Drafted Follow-Up

Drafts should be short, specific, and grounded.

Draft inputs:

- lead first name if available,
- conversation summary,
- prospect profile,
- known property availability/pricing when available,
- fallback text when availability is unknown,
- compliance copy rules,
- operator voice settings.

Draft types:

- email subject + body,
- SMS body,
- internal call note,
- chatbot handoff note.

No draft should invent availability, pricing, deadlines, concessions, or eligibility.

### Knowledge Improvement

Knowledge improvements are suggestions for the chatbot itself.

Examples:

- "Add current starting price range for singles/doubles/triples."
- "Add answer for August/fall availability."
- "Add CTA: offer tour after pricing question."
- "Replace 'contact leasing office' fallback with a capture/tour prompt."

Each improvement includes:

- source pattern,
- affected transcript count,
- suggested knowledge-base text,
- approval state,
- before/after test prompt.

## Telegraph Commons Initial Task Rules

Based on the analysis, the first SG rules should be:

### Rule 1: Warm Chatbot Lead Still New

Trigger:

- lead source = chatbot,
- status = `NEW`,
- intent = warm/hot or prospect profile sentiment = warm/hot,
- last activity older than 24 hours,
- no email/SMS sent from LeaseStack.

Task:

- Draft follow-up asking if they are still looking and offering the next step.

Priority:

- high if move-in is August/fall or ASAP,
- medium otherwise.

### Rule 2: Availability/Pricing Follow-Up Needed

Trigger:

- prospect profile follow-up says availability/pricing,
- contact exists,
- lead not applied/signed.

Task:

- Draft availability/pricing follow-up.
- If live availability is fresh, include specific next step.
- If availability is unknown/stale, avoid specifics and ask for room type/timing.

### Rule 3: Tour Intent No Tour

Trigger:

- transcript/profile indicates tour/visit/schedule,
- no `Tour` record exists,
- contact exists or lead exists.

Task:

- Draft tour scheduling follow-up.

### Rule 4: Engaged But Uncaptured

Trigger:

- conversation has 3-6 messages,
- no lead/contact captured,
- transcript has pricing or availability intent.

Task:

- Create chatbot knowledge improvement, not lead task.
- Suggested bot change: after answering pricing/availability, ask for email/phone to send current openings or tour times.

### Rule 5: Human Contact Punt

Trigger:

- assistant response contains generic "contact/call/email leasing" language,
- no capture or low capture cohort.

Task:

- Knowledge improvement: replace punt with a concrete action.

## UI Integration

### Chatbot Page

Add a "Learning" panel:

- capture rate,
- drop-off cohort count,
- top stalled reasons,
- knowledge improvements waiting approval,
- "Review follow-up tasks" link.

### Conversations Page

Add per-conversation learning status:

- captured / uncaptured,
- inferred intent,
- follow-up needed,
- suggested next action,
- draft available.

### Lead Detail Page

Add "AI follow-up draft" above the existing email/SMS composer:

- draft subject/body or SMS body,
- source reasons,
- edit before sending,
- approve/send,
- dismiss with reason.

Existing send actions can be reused after review. The draft layer should feed them, not bypass them.

### Action Center

Add a task group:

- "Chatbot follow-ups"
- filters: urgency, property, reason, channel, age.

Bulk actions should be review-only at first:

- approve selected,
- dismiss selected,
- snooze selected.

No bulk auto-send in v1.

### Knowledge Base

Add "Suggested improvements":

- grouped by repeated pattern,
- show affected count,
- suggested answer text,
- apply to knowledge base,
- dismiss.

## Recursive Learning Loop

### Feedback Events

Capture operator behavior:

- accepted draft unchanged,
- edited draft before send,
- dismissed draft,
- dismissal reason,
- task snoozed,
- task sent,
- lead advanced after send,
- lead applied/signed later,
- knowledge suggestion accepted/dismissed.

### Learning Signals

The system should learn:

- which follow-up templates operators accept,
- which draft phrases they remove,
- which task types get dismissed,
- which task types lead to status movement,
- which knowledge-base fixes reduce future fallback/punt rate,
- which chatbot intents create applications/signings.

### Model Scope

Do not train a custom model in v1. Store structured feedback and use it to:

- rank tasks,
- choose draft template type,
- improve prompt context,
- generate weekly learning summaries.

## Data Model Direction

Add new persisted models rather than deriving everything at render time:

### `ChatbotLearningCase`

Fields:

- orgId,
- propertyId,
- conversationId,
- leadId,
- caseType,
- status,
- confidence,
- reasonSummary,
- evidenceJson,
- outcomeSnapshotJson,
- createdAt,
- resolvedAt.

### `LeadFollowUpTask`

Fields:

- orgId,
- propertyId,
- leadId,
- conversationId,
- learningCaseId,
- taskType,
- priority,
- status,
- recommendedChannel,
- dueAt,
- reasonSummary,
- createdAt,
- updatedAt.

### `LeadFollowUpDraft`

Fields:

- orgId,
- taskId,
- channel,
- subject,
- body,
- generatedFromJson,
- complianceWarningsJson,
- status,
- editedBody,
- sentAt,
- sentAuditEventId.

### `ChatbotKnowledgeSuggestion`

Fields:

- orgId,
- propertyId,
- patternType,
- affectedCount,
- suggestedText,
- sourceCaseIds,
- status,
- appliedAt,
- dismissedAt.

These should be tenant-scoped and property-RBAC-aware from the start.

## Generation Policy

Drafts must obey:

- no invented pricing,
- no invented availability,
- no invented tour slots,
- no fair-housing-risk statements,
- no pressure/scarcity unless explicitly grounded,
- include human review state,
- preserve unsubscribe rules for email,
- respect missing phone/email.

Use templates first, then AI fill-in. The AI should personalize within a safe structure, not free-write everything.

## First Implementation Slice

### Scope

Build the read/analyze/task/draft loop for chatbot follow-up only.

In scope:

- detector for stalled chatbot leads,
- detector for uncaptured engaged conversations,
- task creation,
- draft generation,
- lead-detail draft review UI,
- action-center list or dashboard panel,
- operator feedback capture,
- SG backfill job for existing conversations/leads.

Out of scope:

- auto-send,
- custom model training,
- two-way inbound email/SMS,
- voice,
- full nurture sequences,
- broad CRM replacement.

## Validation Plan

Run against SG production data in dry-run first:

- number of tasks generated,
- number of high-priority tasks,
- number with email,
- number with phone,
- number blocked by missing contact,
- number of knowledge suggestions,
- sample draft review internally without sending.

Expected initial SG dry-run:

- tasks from 71 `NEW` chatbot leads,
- especially the 35 warm `NEW` chatbot leads,
- availability/pricing as top draft reason,
- tour scheduling as second draft reason,
- knowledge suggestions for human-contact punts and capture CTA gaps.

## Success Criteria

- Leasing team sees a prioritized list of chatbot leads to follow up with.
- Each task explains why it exists.
- Each reachable lead has an editable draft.
- No AI follow-up sends without explicit operator approval.
- Operator edits/dismissals are stored as learning signal.
- Repeated drop-off patterns create knowledge-base suggestions.
- Future reports can say: "These chatbot follow-ups created X tours/applications/signings."

