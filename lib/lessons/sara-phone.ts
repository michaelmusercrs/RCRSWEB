/**
 * Sara's Phone System lesson — written 2026-08-18 as a PREVIEW of the phone
 * system rolling out to the portal. The office FreePBX (Boston PC) bridge is
 * in progress; the portal's Command Center → Phone pages are not yet live
 * for Sara. Content describes ONLY verified, confirmed behavior — nothing
 * here should be treated as "already in the portal" until this lesson is
 * updated to say so.
 */
import type { Lesson } from './types';

export const saraPhoneLesson: Lesson = {
  slug: 'sara-phone',
  moduleId: 'lesson-sara-phone-2026',
  title: 'Phone System — What\'s Coming to the Portal',
  description:
    'A preview of the new phone system: call log, recordings, voicemail with transcription, and who can see what — so you\'re ready the day it goes live.',
  audience: 'Sara / Admin & Office',
  estimatedMinutes: 20,
  sections: [
    {
      title: 'Rolling Out — Here\'s What\'s Coming',
      blocks: [
        { type: 'p', text: 'This lesson is a **preview**. It walks you through a phone system that is being built and rolled out — it is not something you can click into and use today.' },
        { type: 'callout', tone: 'warn', text: 'Not live yet — rolling out. Today, the portal still shows the old placeholder where Command Center → Phone will eventually live. Nothing described in this lesson is available to click on yet.' },
        { type: 'p', text: 'Why read it now? Because when it flips on, it flips on with real call history, real recordings, and real voicemail already flowing in — there won\'t be a slow ramp-up for you to learn as you go. This lesson gets you ready ahead of time so the first day it\'s live feels familiar instead of new.' },
      ],
      keyPoints: [
        'This is a preview, not a how-to for something you can use today',
        'The portal currently shows the old placeholder in place of Phone',
        'Read this now so launch day is familiar, not a surprise',
      ],
    },
    {
      title: 'How It Works — The Boston Bridge',
      blocks: [
        { type: 'p', text: 'The actual phone system — the FreePBX box that answers calls, rings extensions, and records — runs on a computer at the office, nicknamed **Boston**. The portal doesn\'t control the phones and never will.' },
        {
          type: 'steps',
          items: [
            'Calls happen on the office phone system, exactly as they do today',
            'A one-way "bridge" running on the Boston PC reads the call records (CDR) and recordings after the fact',
            'That bridge sends the data to the portal over the internet',
            'The portal receives and displays it — it has no ability to place, end, or redirect a call',
          ],
        },
        { type: 'callout', tone: 'info', text: 'One-way means one-way: the portal is a viewer, not a controller. If a phone issue needs fixing, that\'s still an office-phone-system problem, not a portal problem.' },
      ],
      keyPoints: [
        'FreePBX phone system runs on the Boston PC at the office',
        'A one-way bridge sends call records + recordings to the portal',
        'The portal only displays — it never controls the phones',
      ],
    },
    {
      title: 'The Call Log & Recordings',
      blocks: [
        { type: 'p', text: 'Once live, the phone system will sit under **Command Center → Phone**, with a dashboard, a **Call Log**, **Voicemail**, a directory ("manage"), and a page for each extension.' },
        { type: 'p', text: 'Calls are recorded, and you\'ll be able to play them back **securely inside the portal** — the audio never goes out as a public link anyone could grab and share.' },
        {
          type: 'bullets',
          items: [
            'Recordings are available for calls starting around **July 31, 2026**',
            'Clean audio across all answer types — desk phone, Google Voice, and the answering service — starting around **August 2, 2026**',
          ],
        },
        { type: 'p', text: 'The dashboard will also show call **analytics**: call volume, inbound vs. outbound, missed calls, average call duration, breakdowns by person, and peak calling hours. Deeper stage-by-stage analytics are still being built beyond that.' },
        { type: 'callout', tone: 'tip', text: 'Why early call-volume numbers might look low: the published office number is being ported to VoIP. Until that port finishes (around mid-August 2026), a second caller dialing in at the same time as an existing call can get a busy signal instead of ringing through — so don\'t read early volume numbers as the full picture.' },
      ],
      keyPoints: [
        'Command Center → Phone: dashboard, Call Log, Voicemail, directory, per-extension view',
        'Recordings play back securely inside the portal — never a public link',
        'Recordings from ~July 31, 2026; clean audio on all answer types from ~Aug 2, 2026',
        'Analytics: volume, inbound/outbound, missed calls, avg duration, by-person, peak hours',
      ],
    },
    {
      title: 'Voicemail & Transcription — What It Is (and Isn\'t)',
      blocks: [
        { type: 'p', text: 'Voicemails get captured and **automatically transcribed to text** — using OpenAI Whisper on the voicemail audio — so you can read a message at a glance instead of dialing in and listening.' },
        { type: 'callout', tone: 'warn', text: 'Important distinction: transcription applies to VOICEMAIL messages only. There is no AI summary, transcript, or "notes on what was said" for live phone conversations. If a call was answered and talked through, the system does not produce any written record of that conversation — only a message left in a mailbox gets transcribed.' },
        { type: 'p', text: 'So: a missed call that goes to voicemail → you\'ll get readable text. A call that gets answered and handled live → no text record exists, no matter how the conversation went.' },
      ],
      keyPoints: [
        'Voicemail audio is auto-transcribed to text (OpenAI Whisper)',
        'This is voicemail-only — there is no AI summary of live phone calls',
        'Answered calls leave no written record; only unanswered calls that hit voicemail do',
      ],
      quiz: [
        {
          question: 'A rep tells you "just check the AI summary of my call with the customer." What\'s actually true?',
          options: [
            'The system has that — check the Call Log',
            'That doesn\'t exist. Only voicemail messages get transcribed to text; live conversations are never summarized',
            'It exists but only for admins',
            'You\'d need to ask Michael to turn it on',
          ],
          correct: 1,
          explanation: 'Transcription only runs on voicemail audio. There is no feature that summarizes or transcribes a live, answered phone conversation.',
        },
      ],
    },
    {
      title: 'What You Can See vs. What a Rep Sees',
      blocks: [
        { type: 'p', text: 'Visibility into the phone system is scoped by role:' },
        {
          type: 'table',
          headers: ['Role', 'What they see'],
          rows: [
            ['Owner, Admin, Manager', 'ALL calls, recordings, and analytics — company-wide'],
            ['Sales / Office', 'ONLY their own extension\'s calls and voicemails'],
          ],
        },
        { type: 'p', text: 'You\'re an **admin**, so you\'ll see everything — every extension\'s calls, every recording, the full analytics picture. That\'s the same broad visibility you already have in the rest of the portal.' },
        { type: 'callout', tone: 'info', text: 'Worth knowing: if your role were ever changed to plain "office" instead of admin, your phone visibility would narrow to just your own extension. That\'s not something you need to act on — just good to understand why visibility is tied to role, not to who you are.' },
      ],
      keyPoints: [
        'Owner/admin/manager see all calls, recordings, and analytics',
        'Sales/office roles see only their own extension',
        'Sara is admin — full visibility',
      ],
    },
    {
      title: 'Feature Codes & Your Extension',
      blocks: [
        { type: 'p', text: 'Your extension is **103**, and you\'re on the first ring group — meaning when the main office line rings, you\'re one of the first phones it hits.' },
        { type: 'p', text: 'A few codes you can dial on a desk phone once the system is live:' },
        {
          type: 'table',
          headers: ['Code', 'What it does'],
          rows: [
            ['*97', 'Check your own voicemail. PIN is "1" followed by your extension — for you that\'s **1103**'],
            ['*1XX', 'Send a caller straight to an extension\'s voicemail. For your mailbox specifically: **\\*103**'],
            ['*43', 'Echo test — quick way to confirm your line is working'],
          ],
        },
        { type: 'callout', tone: 'tip', text: 'These three codes are what\'s actually set up. If you\'ve used other FreePBX systems before and remember different codes from other jobs, don\'t assume they work here — stick to *97, *1XX, and *43.' },
      ],
      keyPoints: [
        'Sara = extension 103, first ring group on the main line',
        '*97 checks voicemail (PIN 1103); *1XX sends a caller to an extension\'s voicemail (*103 = Sara\'s); *43 is the echo test',
      ],
      quiz: [
        {
          question: 'What does *97 do, and what\'s Sara\'s PIN?',
          options: [
            'Sends a caller to voicemail; PIN is 103',
            'Checks your own voicemail; PIN is 1103 (a "1" plus her extension)',
            'Runs an echo test; no PIN needed',
            'Transfers a call; PIN is 97103',
          ],
          correct: 1,
          explanation: '*97 checks your own voicemail. The PIN pattern is the digit 1 followed by your extension — Sara is 103, so her PIN is 1103.',
        },
        {
          question: 'Right now, today, can Sara click into Command Center → Phone in the portal?',
          options: [
            'Yes, it\'s fully live with all features',
            'No — it\'s still rolling out; the portal currently shows the old placeholder there',
            'Yes, but only recordings work',
            'Only if Michael turns on a feature flag for her',
          ],
          correct: 1,
          explanation: 'The phone system is a preview in this lesson. It is not live yet — the portal still shows the old placeholder in that spot.',
        },
      ],
    },
  ],
};
