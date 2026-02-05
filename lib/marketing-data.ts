/**
 * RCRS Command Center - Marketing Hub Data
 *
 * Contains all marketing content for Q1 2026 including:
 * - 10 Digital Ad variations
 * - 5 Email templates
 * - Content calendar events
 * - Campaign statistics
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

export type AdPlatform = 'Facebook' | 'Instagram' | 'Google' | 'Print' | 'All';
export type AdFormat = 'Image' | 'Video' | 'Carousel' | 'Banner';
export type EmailType = 'welcome' | 'storm' | 'financing' | 'seasonal' | 'followup';
export type CalendarEventType = 'Social' | 'Email' | 'Blog' | 'Ad' | 'Meeting';

export interface Ad {
  id: string;
  platform: AdPlatform;
  format: AdFormat;
  headline: string;
  body: string;
  cta: string;
  targetAudience: string;
  visual: string;
  month?: string;
  focus: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  type: EmailType;
  subject: string;
  preheader: string;
  htmlContent: string;
  textContent: string;
  trigger: string;
  whenToUse: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  type: CalendarEventType;
  title: string;
  description: string;
  channel?: string;
}

export interface CampaignStats {
  activeCampaigns: number;
  emailTemplates: number;
  adVariations: number;
  scheduledPosts: number;
}

export interface Q1Goals {
  leadsPerMonth: number;
  websiteTrafficIncrease: number;
  socialEngagementIncrease: number;
  emailOpenRate: number;
  conversionRate: number;
  financingApplicationRate: number;
}

// =============================================================================
// CAMPAIGN STATISTICS
// =============================================================================

export const CAMPAIGN_STATS: CampaignStats = {
  activeCampaigns: 4,
  emailTemplates: 5,
  adVariations: 10,
  scheduledPosts: 87,
};

export const Q1_GOALS: Q1Goals = {
  leadsPerMonth: 150,
  websiteTrafficIncrease: 25,
  socialEngagementIncrease: 15,
  emailOpenRate: 25,
  conversionRate: 12,
  financingApplicationRate: 30,
};

// =============================================================================
// AD CONTENT
// =============================================================================

export const ADS: Ad[] = [
  {
    id: 'ad-1',
    platform: 'Facebook',
    format: 'Image',
    headline: 'Family-Owned. Community-Trusted.',
    body: 'When you choose River City Roofing, you choose a family that cares. No corporate call centers—just real people who treat your home like their own. Free estimates. Quality workmanship. A name you can trust.',
    cta: 'Get Your Free Estimate',
    targetAudience: 'Homeowners 35-65, property owners',
    visual: 'Black background, lime green accents, family-owned badge icon',
    focus: 'Family Values - General Brand',
  },
  {
    id: 'ad-2',
    platform: 'Facebook',
    format: 'Image',
    headline: 'New Roof? Apply in Just 3 Minutes.',
    body: "Don't wait on your roof repairs. Our instant financing application takes only 3 minutes—right from your phone. Get fast approval, affordable monthly payments, and peace of mind. No long waits. No complicated paperwork.",
    cta: "Apply Now - It's Fast & Easy",
    targetAudience: 'Budget-conscious homeowners, first-time buyers',
    visual: 'Smartphone showing "APPROVED" screen, lime green check mark, black background',
    focus: '3-Minute Financing - Lead Gen',
  },
  {
    id: 'ad-3',
    platform: 'Facebook',
    format: 'Video',
    headline: "Storm Damage? Don't Wait—Call Today.",
    body: 'Recent storms can cause hidden damage that gets worse over time. Our storm damage experts provide FREE inspections, handle insurance paperwork, and get your roof repaired fast. Protect your home before small problems become big expenses.',
    cta: 'Schedule Free Storm Inspection',
    targetAudience: 'Recent storm area residents, insurance claim seekers',
    visual: 'Storm clouds, damaged roof imagery, lime green "EMERGENCY RESPONSE" badge',
    focus: 'Storm Damage - Urgency',
  },
  {
    id: 'ad-4',
    platform: 'Google',
    format: 'Banner',
    headline: 'Storm Damage + Fast Financing = Peace of Mind',
    body: "Don't let unexpected roof damage drain your savings. Apply for financing in 3 minutes and get your storm repairs started today. Free inspections. Insurance assistance. Affordable payments.",
    cta: 'Get Started Today',
    targetAudience: 'Storm damage searchers, financing seekers',
    visual: 'Split design—storm damage on left, financing approval on right, lime green divider',
    focus: 'Financing + Storm Combo',
  },
  {
    id: 'ad-5',
    platform: 'Facebook',
    format: 'Carousel',
    headline: 'Three Reasons Families Trust Us',
    body: 'Slide 1: Family-Owned & Operated—Your Neighbors, Not a Corporation\nSlide 2: "They treated us like family. Best roofing experience we\'ve had." - Local Customer\nSlide 3: Quality Craftsmanship on Every Project\nSlide 4: Fast Financing—Apply in 3 Minutes',
    cta: 'See Why Families Choose Us',
    targetAudience: 'Trust-seeking homeowners, referral audience',
    visual: 'Team photo, customer testimonial, before/after project, financing offer',
    focus: 'Family Business - Trust Builder',
  },
  {
    id: 'ad-6',
    platform: 'All',
    format: 'Image',
    headline: 'New Year. New Roof. New Payment Options.',
    body: 'Start 2026 with a roof you can count on. This January, get a FREE inspection plus instant financing approval in just 3 minutes. Family-owned service. Quality you can trust. Payments that fit your budget.',
    cta: 'Claim Your Free Inspection',
    targetAudience: 'New year resolution makers, home improvers',
    visual: 'Black background with lime green "2026" and roof silhouette',
    month: 'January',
    focus: 'New Year Promotion',
  },
  {
    id: 'ad-7',
    platform: 'Facebook',
    format: 'Image',
    headline: 'Show Your Home Some Love This February',
    body: "Your home protects your family—make sure your roof protects your home. This February, schedule a FREE roof inspection with our family-owned team. If repairs are needed, financing takes just 3 minutes to apply.",
    cta: 'Schedule Free Inspection',
    targetAudience: 'Homeowners, family-focused audience',
    visual: 'Home with heart icon, black and lime green theme',
    month: 'February',
    focus: 'Love Your Home',
  },
  {
    id: 'ad-8',
    platform: 'All',
    format: 'Video',
    headline: 'Storm Season Is Coming. Is Your Roof Ready?',
    body: "Don't wait for the first big storm to find out your roof has problems. Our FREE pre-storm inspections identify weak spots before they become leaks. Family-owned expertise. Fast financing if repairs are needed. Protect your home NOW.",
    cta: 'Get Pre-Storm Inspection',
    targetAudience: 'Proactive homeowners, weather-aware audience',
    visual: 'Storm footage transitioning to repaired roof, lime green "BE PREPARED" text',
    month: 'March',
    focus: 'Storm Season Prep',
  },
  {
    id: 'ad-9',
    platform: 'Google',
    format: 'Image',
    headline: 'Storm Damage? We Handle Your Insurance Claim.',
    body: "Filing insurance claims is stressful. Our storm damage experts document everything, communicate with your insurance company, and fight for the coverage you deserve. Family-owned attention. Professional results. Free inspection to start.",
    cta: 'Start Your Claim Today',
    targetAudience: 'Insurance claim seekers, storm damage victims',
    visual: 'Insurance document with lime green checkmarks, "WE HANDLE THE PAPERWORK" text',
    focus: 'Insurance Help - Storm Focus',
  },
  {
    id: 'ad-10',
    platform: 'Facebook',
    format: 'Image',
    headline: '"They Made It So Easy!"',
    body: '"We had storm damage and didn\'t know where to start. River City Roofing did the inspection, helped with our insurance, and got us approved for financing in 3 minutes. As a family-owned business, they really cared about getting it right. Highly recommend!" — Satisfied Customer\n\nJoin hundreds of families who trust River City Roofing Solutions.',
    cta: 'Get Your Free Estimate',
    targetAudience: 'Social proof seekers, referral audience',
    visual: 'Black background, large lime green quotation marks, customer quote',
    focus: 'Testimonial/Social Proof',
  },
];

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

export const EMAILS: EmailTemplate[] = [
  {
    id: 'email-1',
    name: 'Welcome Email',
    type: 'welcome',
    subject: 'Welcome to the River City Roofing Family!',
    preheader: "You're in good hands with our family-owned team...",
    trigger: 'Form submission',
    whenToUse: 'New lead enters system',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to River City Roofing Solutions</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <!-- Header -->
    <tr>
      <td style="background-color: #0A0A0A; padding: 30px; text-align: center;">
        <h1 style="color: #32CD32; margin: 0; font-size: 28px;">River City Roofing Solutions</h1>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="background-color: #1a1a1a; padding: 40px 30px;">
        <h2 style="color: #ffffff; margin: 0 0 20px 0;">Welcome to River City Roofing Solutions!</h2>
        <p style="color: #cccccc; line-height: 1.6;">Hi {{FirstName}},</p>
        <p style="color: #cccccc; line-height: 1.6;">Thank you for reaching out to us! As a <strong style="color: #32CD32;">family-owned roofing company</strong>, we're excited to help protect your home.</p>

        <p style="color: #ffffff; font-weight: bold; margin-top: 30px;">Here's what makes us different:</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
          <tr>
            <td style="padding: 15px; background-color: #252525; border-left: 4px solid #32CD32;">
              <p style="color: #32CD32; margin: 0 0 5px 0; font-weight: bold;">Family-Owned & Operated</p>
              <p style="color: #aaaaaa; margin: 0; font-size: 14px;">You'll work with real people who care—not a corporate call center.</p>
            </td>
          </tr>
          <tr><td style="height: 10px;"></td></tr>
          <tr>
            <td style="padding: 15px; background-color: #252525; border-left: 4px solid #32CD32;">
              <p style="color: #32CD32; margin: 0 0 5px 0; font-weight: bold;">Instant Financing—Apply in 3 Minutes</p>
              <p style="color: #aaaaaa; margin: 0; font-size: 14px;">Get approved quickly and know your payment options before we finish the estimate.</p>
            </td>
          </tr>
          <tr><td style="height: 10px;"></td></tr>
          <tr>
            <td style="padding: 15px; background-color: #252525; border-left: 4px solid #32CD32;">
              <p style="color: #32CD32; margin: 0 0 5px 0; font-weight: bold;">Storm Damage Experts</p>
              <p style="color: #aaaaaa; margin: 0; font-size: 14px;">From inspection to insurance assistance, we handle it all.</p>
            </td>
          </tr>
        </table>

        <p style="color: #ffffff; font-weight: bold; margin-top: 30px;">What's Next?</p>
        <p style="color: #cccccc; line-height: 1.6;">One of our roofing specialists will contact you within 24 hours to schedule your <strong>FREE inspection</strong>.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="display: inline-block; background-color: #32CD32; color: #0A0A0A; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 5px;">Learn More About Our Services</a>
        </div>

        <p style="color: #cccccc; line-height: 1.6;">Warm regards,<br><strong style="color: #32CD32;">The River City Roofing Solutions Family</strong></p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color: #0A0A0A; padding: 30px; text-align: center;">
        <p style="color: #666666; margin: 0; font-size: 12px;">River City Roofing Solutions<br>Family-Owned. Community-Trusted.</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `Welcome to River City Roofing Solutions!

Hi {{FirstName}},

Thank you for reaching out to us! As a family-owned roofing company, we're excited to help protect your home.

Here's what makes us different:

* FAMILY-OWNED & OPERATED
You'll work with real people who care—not a corporate call center. We treat every home like it's our own.

* INSTANT FINANCING—APPLY IN 3 MINUTES
Need a new roof but worried about the cost? Our fast financing application takes just 3 minutes. Get approved quickly and know your payment options before we even finish the estimate.

* STORM DAMAGE EXPERTS
From inspection to insurance assistance, we handle it all. If you've experienced storm damage, we'll fight to get you the coverage you deserve.

WHAT'S NEXT?

One of our roofing specialists will contact you within 24 hours to schedule your FREE inspection. In the meantime, feel free to call us directly.

We look forward to serving you!

Warm regards,
The River City Roofing Solutions Family

---
River City Roofing Solutions
Family-Owned. Community-Trusted.`,
  },
  {
    id: 'email-2',
    name: 'Storm Damage Alert',
    type: 'storm',
    subject: 'Recent Storm? Get Your FREE Roof Inspection',
    preheader: 'Hidden damage gets worse over time—schedule your free inspection today...',
    trigger: 'Manual send to local list',
    whenToUse: 'After severe weather events',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Storm Damage Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <!-- Header with storm imagery -->
    <tr>
      <td style="background: linear-gradient(135deg, #1a1a1a 0%, #0A0A0A 100%); padding: 30px; text-align: center; border-bottom: 3px solid #32CD32;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⚠️ STORM DAMAGE ALERT</h1>
        <p style="color: #32CD32; margin: 10px 0 0 0;">River City Roofing Solutions</p>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="background-color: #1a1a1a; padding: 40px 30px;">
        <h2 style="color: #ffffff; margin: 0 0 20px 0;">Don't Wait—Storm Damage Gets Worse Over Time</h2>
        <p style="color: #cccccc; line-height: 1.6;">Hi {{FirstName}},</p>
        <p style="color: #cccccc; line-height: 1.6;">Recent severe weather in our area may have caused damage to your roof that you can't see from the ground. <strong style="color: #ff6b6b;">Hidden damage leads to leaks, mold, and expensive repairs</strong> if left unchecked.</p>

        <h3 style="color: #32CD32; margin: 30px 0 15px 0;">Our Storm Damage Experts Are Ready to Help</h3>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
          <tr>
            <td style="padding: 15px; background-color: #252525;">
              <p style="color: #32CD32; margin: 0 0 5px 0; font-weight: bold;">✓ FREE Comprehensive Inspection</p>
              <p style="color: #aaaaaa; margin: 0; font-size: 14px;">We'll thoroughly examine your roof and document any damage—at no cost to you.</p>
            </td>
          </tr>
          <tr><td style="height: 10px;"></td></tr>
          <tr>
            <td style="padding: 15px; background-color: #252525;">
              <p style="color: #32CD32; margin: 0 0 5px 0; font-weight: bold;">✓ Insurance Claim Assistance</p>
              <p style="color: #aaaaaa; margin: 0; font-size: 14px;">We handle the paperwork and communicate directly with your insurance company.</p>
            </td>
          </tr>
          <tr><td style="height: 10px;"></td></tr>
          <tr>
            <td style="padding: 15px; background-color: #252525;">
              <p style="color: #32CD32; margin: 0 0 5px 0; font-weight: bold;">✓ Fast Financing Available</p>
              <p style="color: #aaaaaa; margin: 0; font-size: 14px;">Apply for financing in just 3 minutes and get affordable monthly payments.</p>
            </td>
          </tr>
        </table>

        <p style="color: #cccccc; line-height: 1.6;">As a <strong style="color: #32CD32;">family-owned business</strong>, we understand how stressful storm damage can be. That's why we respond quickly, communicate clearly, and stand behind every repair.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="display: inline-block; background-color: #32CD32; color: #0A0A0A; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 5px;">Schedule Your FREE Storm Inspection</a>
        </div>

        <p style="color: #ff6b6b; font-weight: bold; text-align: center;">Don't wait for a small problem to become a big expense.</p>

        <p style="color: #cccccc; line-height: 1.6; margin-top: 30px;">Protecting your home,<br><strong style="color: #32CD32;">The River City Roofing Solutions Family</strong></p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color: #0A0A0A; padding: 30px; text-align: center;">
        <p style="color: #666666; margin: 0; font-size: 12px;">River City Roofing Solutions<br>Storm Damage Specialists | Family-Owned</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `STORM DAMAGE ALERT

Don't Wait—Storm Damage Gets Worse Over Time

Hi {{FirstName}},

Recent severe weather in our area may have caused damage to your roof that you can't see from the ground. Hidden damage leads to leaks, mold, and expensive repairs if left unchecked.

OUR STORM DAMAGE EXPERTS ARE READY TO HELP

✓ FREE Comprehensive Inspection
We'll thoroughly examine your roof and document any damage—at no cost to you.

✓ Insurance Claim Assistance
We handle the paperwork and communicate directly with your insurance company. You focus on your family—we'll fight for your coverage.

✓ Fast Financing Available
If your deductible or uncovered costs are a concern, apply for financing in just 3 minutes and get affordable monthly payments.

As a family-owned business, we understand how stressful storm damage can be. That's why we respond quickly, communicate clearly, and stand behind every repair.

>> SCHEDULE YOUR FREE STORM INSPECTION <<

Don't wait for a small problem to become a big expense.

Protecting your home,
The River City Roofing Solutions Family

---
River City Roofing Solutions
Storm Damage Specialists | Family-Owned`,
  },
  {
    id: 'email-3',
    name: 'Job Complete Email',
    type: 'followup',
    subject: 'Your Roofing Estimate + Easy Next Steps',
    preheader: "Review your estimate and explore financing options—we're here to help...",
    trigger: 'Manual or CRM trigger',
    whenToUse: 'After in-home estimate',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Roofing Estimate</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <!-- Header -->
    <tr>
      <td style="background-color: #0A0A0A; padding: 30px; text-align: center;">
        <h1 style="color: #32CD32; margin: 0; font-size: 28px;">River City Roofing Solutions</h1>
        <p style="color: #888888; margin: 10px 0 0 0;">Your Estimate</p>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="background-color: #1a1a1a; padding: 40px 30px;">
        <h2 style="color: #ffffff; margin: 0 0 20px 0;">Thank You for Choosing River City Roofing Solutions!</h2>
        <p style="color: #cccccc; line-height: 1.6;">Hi {{FirstName}},</p>
        <p style="color: #cccccc; line-height: 1.6;">It was great meeting with you! Attached you'll find your detailed roofing estimate. We wanted to follow up with some important information to help you make the best decision for your home.</p>

        <div style="background-color: #252525; padding: 20px; margin: 25px 0; border-radius: 8px;">
          <h3 style="color: #32CD32; margin: 0 0 15px 0;">Your Estimate Summary</h3>
          <p style="color: #ffffff; margin: 5px 0;"><strong>Project:</strong> {{ProjectType}}</p>
          <p style="color: #ffffff; margin: 5px 0;"><strong>Estimated Investment:</strong> {{EstimateAmount}}</p>
          <p style="color: #888888; margin: 10px 0 0 0; font-size: 13px;"><em>Full details are in the attached PDF.</em></p>
        </div>

        <h3 style="color: #32CD32; margin: 30px 0 15px 0;">Easy Financing—Just 3 Minutes to Apply</h3>
        <p style="color: #cccccc; line-height: 1.6;">Concerned about the investment? Our instant financing makes it simple:</p>

        <ul style="color: #cccccc; line-height: 1.8;">
          <li>Apply in 3 minutes—online or by phone</li>
          <li>Get fast approval decisions</li>
          <li>Choose affordable monthly payments</li>
          <li>Start your project sooner</li>
        </ul>

        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="display: inline-block; background-color: #32CD32; color: #0A0A0A; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 5px;">Apply for Financing Now</a>
        </div>

        <h3 style="color: #32CD32; margin: 30px 0 15px 0;">Why Choose River City Roofing?</h3>
        <p style="color: #cccccc; line-height: 1.6;"><strong style="color: #ffffff;">Family-Owned Values:</strong> We're not a corporate franchise. When you call, you get real people who care about your home.</p>
        <p style="color: #cccccc; line-height: 1.6;"><strong style="color: #ffffff;">Quality Workmanship:</strong> We stand behind every project with industry-leading warranties.</p>
        <p style="color: #cccccc; line-height: 1.6;"><strong style="color: #ffffff;">Storm Damage Expertise:</strong> If your project involves storm damage, we'll handle the insurance communication for you.</p>

        <p style="color: #cccccc; line-height: 1.6; margin-top: 30px;">Warm regards,<br><strong style="color: #32CD32;">{{SalesRepName}}</strong><br>River City Roofing Solutions</p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color: #0A0A0A; padding: 30px; text-align: center;">
        <p style="color: #666666; margin: 0; font-size: 12px;">River City Roofing Solutions<br>Family-Owned. Quality-Focused. Community-Trusted.</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `Thank You for Choosing River City Roofing Solutions!

Hi {{FirstName}},

It was great meeting with you! Attached you'll find your detailed roofing estimate. We wanted to follow up with some important information to help you make the best decision for your home.

YOUR ESTIMATE SUMMARY
Project: {{ProjectType}}
Estimated Investment: {{EstimateAmount}}

Full details are in the attached PDF.

EASY FINANCING—JUST 3 MINUTES TO APPLY

Concerned about the investment? Our instant financing makes it simple:

* Apply in 3 minutes—online or by phone
* Get fast approval decisions
* Choose affordable monthly payments
* Start your project sooner

>> APPLY FOR FINANCING NOW <<

WHY CHOOSE RIVER CITY ROOFING?

Family-Owned Values: We're not a corporate franchise. When you call, you get real people who care about your home.

Quality Workmanship: We stand behind every project with industry-leading warranties.

Storm Damage Expertise: If your project involves storm damage, we'll handle the insurance communication for you.

Questions? We're Here to Help.
Don't hesitate to reach out if you have any questions about your estimate, financing options, or the installation process.

Warm regards,
{{SalesRepName}}
River City Roofing Solutions

---
River City Roofing Solutions
Family-Owned. Quality-Focused. Community-Trusted.`,
  },
  {
    id: 'email-4',
    name: 'Referral Request',
    type: 'followup',
    subject: 'Your New Roof is Just 3 Minutes Away',
    preheader: 'Fast financing, affordable payments, no hassle—apply today...',
    trigger: '3-5 days after welcome',
    whenToUse: 'Mid-funnel nurture',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Financing Spotlight</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <!-- Header -->
    <tr>
      <td style="background-color: #0A0A0A; padding: 30px; text-align: center;">
        <h1 style="color: #32CD32; margin: 0; font-size: 28px;">River City Roofing Solutions</h1>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="background-color: #1a1a1a; padding: 40px 30px;">
        <h2 style="color: #ffffff; margin: 0 0 20px 0;">Get Approved for Roof Financing in 3 Minutes</h2>
        <p style="color: #cccccc; line-height: 1.6;">Hi {{FirstName}},</p>
        <p style="color: #cccccc; line-height: 1.6;">Worried about affording a new roof? <strong style="color: #32CD32;">Don't let budget concerns put your home at risk.</strong></p>
        <p style="color: #cccccc; line-height: 1.6;">Our instant financing makes it easy:</p>

        <h3 style="color: #32CD32; margin: 30px 0 15px 0;">How It Works</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
          <tr>
            <td style="padding: 15px; background-color: #252525; text-align: center; width: 25%;">
              <p style="color: #32CD32; margin: 0; font-size: 24px; font-weight: bold;">1</p>
              <p style="color: #aaaaaa; margin: 5px 0 0 0; font-size: 13px;">Apply online—3 min</p>
            </td>
            <td style="width: 2%;"></td>
            <td style="padding: 15px; background-color: #252525; text-align: center; width: 25%;">
              <p style="color: #32CD32; margin: 0; font-size: 24px; font-weight: bold;">2</p>
              <p style="color: #aaaaaa; margin: 5px 0 0 0; font-size: 13px;">Fast approval</p>
            </td>
            <td style="width: 2%;"></td>
            <td style="padding: 15px; background-color: #252525; text-align: center; width: 25%;">
              <p style="color: #32CD32; margin: 0; font-size: 24px; font-weight: bold;">3</p>
              <p style="color: #aaaaaa; margin: 5px 0 0 0; font-size: 13px;">Choose payment</p>
            </td>
            <td style="width: 2%;"></td>
            <td style="padding: 15px; background-color: #252525; text-align: center; width: 25%;">
              <p style="color: #32CD32; margin: 0; font-size: 24px; font-weight: bold;">4</p>
              <p style="color: #aaaaaa; margin: 5px 0 0 0; font-size: 13px;">New roof!</p>
            </td>
          </tr>
        </table>

        <h3 style="color: #32CD32; margin: 30px 0 15px 0;">Why Homeowners Love Our Financing</h3>
        <ul style="color: #cccccc; line-height: 1.8;">
          <li><strong style="color: #ffffff;">Fast Application</strong> — 3 minutes, not 3 days</li>
          <li><strong style="color: #ffffff;">Quick Decisions</strong> — Know your options right away</li>
          <li><strong style="color: #ffffff;">Flexible Payments</strong> — Find a plan that fits your budget</li>
          <li><strong style="color: #ffffff;">No Surprises</strong> — Clear terms you can understand</li>
        </ul>

        <p style="color: #cccccc; line-height: 1.6; margin-top: 25px;"><strong style="color: #32CD32;">Plus, you get the family-owned difference:</strong></p>
        <p style="color: #cccccc; line-height: 1.6;">When you work with River City Roofing Solutions, you're not a number. You're a neighbor. We'll walk you through every option and help you make the best decision for your family.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="display: inline-block; background-color: #32CD32; color: #0A0A0A; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 5px;">Apply for Financing Now</a>
        </div>

        <p style="color: #cccccc; line-height: 1.6;">Your roof protects everything you love. Let us help you protect it.</p>
        <p style="color: #cccccc; line-height: 1.6;"><strong style="color: #32CD32;">The River City Roofing Solutions Family</strong></p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color: #0A0A0A; padding: 30px; text-align: center;">
        <p style="color: #666666; margin: 0; font-size: 12px;">River City Roofing Solutions<br>Fast Financing. Family Values.</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `Get Approved for Roof Financing in 3 Minutes

Hi {{FirstName}},

Worried about affording a new roof? Don't let budget concerns put your home at risk.

Our instant financing makes it easy:

HOW IT WORKS

Step 1: Apply online or in-person—takes just 3 minutes
Step 2: Get your approval decision fast
Step 3: Choose the monthly payment that works for you
Step 4: We install your new roof!

WHY HOMEOWNERS LOVE OUR FINANCING

* Fast Application — 3 minutes, not 3 days
* Quick Decisions — Know your options right away
* Flexible Payments — Find a plan that fits your budget
* No Surprises — Clear terms you can understand

PLUS, YOU GET THE FAMILY-OWNED DIFFERENCE

When you work with River City Roofing Solutions, you're not a number. You're a neighbor. We'll walk you through every option and help you make the best decision for your family.

>> APPLY FOR FINANCING NOW <<

Or call us to discuss your options.

Your roof protects everything you love. Let us help you protect it.

The River City Roofing Solutions Family

---
River City Roofing Solutions
Fast Financing. Family Values.`,
  },
  {
    id: 'email-5',
    name: 'Storm Season Prep',
    type: 'seasonal',
    subject: 'Is Your Roof Ready for Storm Season?',
    preheader: 'Free pre-storm inspections available—protect your home before severe weather hits...',
    trigger: 'Scheduled campaign',
    whenToUse: 'February/Early March',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Storm Season Prep</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #1a1a1a 0%, #0A0A0A 100%); padding: 30px; text-align: center;">
        <div style="display: inline-block; background-color: #32CD32; color: #0A0A0A; padding: 8px 20px; font-weight: bold; border-radius: 20px; font-size: 14px;">BE PREPARED</div>
        <h1 style="color: #ffffff; margin: 15px 0 0 0; font-size: 28px;">River City Roofing Solutions</h1>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="background-color: #1a1a1a; padding: 40px 30px;">
        <h2 style="color: #ffffff; margin: 0 0 20px 0;">Storm Season is Coming—Is Your Roof Ready?</h2>
        <p style="color: #cccccc; line-height: 1.6;">Hi {{FirstName}},</p>
        <p style="color: #cccccc; line-height: 1.6;">Spring storms will be here before you know it. <strong style="color: #32CD32;">Now is the perfect time to make sure your roof can handle whatever nature throws at it.</strong></p>

        <h3 style="color: #32CD32; margin: 30px 0 15px 0;">Schedule Your FREE Pre-Storm Inspection</h3>
        <p style="color: #cccccc; line-height: 1.6;">Our experienced team will:</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
          <tr>
            <td style="padding: 12px 15px; background-color: #252525;">
              <p style="color: #32CD32; margin: 0;">✓ <strong>Identify Weak Spots</strong></p>
              <p style="color: #888888; margin: 5px 0 0 0; font-size: 13px;">Find potential problems before they become leaks</p>
            </td>
          </tr>
          <tr><td style="height: 5px;"></td></tr>
          <tr>
            <td style="padding: 12px 15px; background-color: #252525;">
              <p style="color: #32CD32; margin: 0;">✓ <strong>Check for Existing Damage</strong></p>
              <p style="color: #888888; margin: 5px 0 0 0; font-size: 13px;">Spot wear and tear from winter weather</p>
            </td>
          </tr>
          <tr><td style="height: 5px;"></td></tr>
          <tr>
            <td style="padding: 12px 15px; background-color: #252525;">
              <p style="color: #32CD32; margin: 0;">✓ <strong>Document Everything</strong></p>
              <p style="color: #888888; margin: 5px 0 0 0; font-size: 13px;">Provide a detailed report of your roof's condition</p>
            </td>
          </tr>
          <tr><td style="height: 5px;"></td></tr>
          <tr>
            <td style="padding: 12px 15px; background-color: #252525;">
              <p style="color: #32CD32; margin: 0;">✓ <strong>Recommend Solutions</strong></p>
              <p style="color: #888888; margin: 5px 0 0 0; font-size: 13px;">Give you honest advice on what needs attention</p>
            </td>
          </tr>
        </table>

        <h3 style="color: #32CD32; margin: 30px 0 15px 0;">Why Get Inspected Now?</h3>
        <ul style="color: #cccccc; line-height: 1.8;">
          <li><strong style="color: #ffffff;">Avoid Emergency Repairs</strong> — Planned maintenance is always cheaper than emergency fixes</li>
          <li><strong style="color: #ffffff;">Beat the Rush</strong> — Schedule now while our calendar is open</li>
          <li><strong style="color: #ffffff;">Peace of Mind</strong> — Know your family is protected when storms hit</li>
        </ul>

        <div style="background-color: #252525; padding: 20px; margin: 25px 0; border-radius: 8px; border-left: 4px solid #32CD32;">
          <p style="color: #ffffff; margin: 0;"><strong>If Repairs Are Needed:</strong></p>
          <p style="color: #cccccc; margin: 10px 0 0 0;">As a family-owned company, we'll never pressure you into unnecessary work. But if your roof does need attention, we offer <strong style="color: #32CD32;">instant financing—apply in just 3 minutes</strong> and get affordable monthly payments.</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="#" style="display: inline-block; background-color: #32CD32; color: #0A0A0A; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 5px;">Schedule Your FREE Pre-Storm Inspection</a>
        </div>

        <p style="color: #cccccc; line-height: 1.6;">Protecting homes. Protecting families.</p>
        <p style="color: #cccccc; line-height: 1.6;"><strong style="color: #32CD32;">The River City Roofing Solutions Family</strong></p>

        <p style="color: #888888; font-size: 13px; margin-top: 25px;"><em>P.S. — Already have visible damage? Don't wait—call us today for priority scheduling.</em></p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color: #0A0A0A; padding: 30px; text-align: center;">
        <p style="color: #666666; margin: 0; font-size: 12px;">River City Roofing Solutions<br>Family-Owned Storm Damage Experts</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `BE PREPARED

Storm Season is Coming—Is Your Roof Ready?

Hi {{FirstName}},

Spring storms will be here before you know it. Now is the perfect time to make sure your roof can handle whatever nature throws at it.

SCHEDULE YOUR FREE PRE-STORM INSPECTION

Our experienced team will:

✓ Identify Weak Spots — Find potential problems before they become leaks
✓ Check for Existing Damage — Spot wear and tear from winter weather
✓ Document Everything — Provide a detailed report of your roof's condition
✓ Recommend Solutions — Give you honest advice on what (if anything) needs attention

WHY GET INSPECTED NOW?

* Avoid Emergency Repairs — Planned maintenance is always cheaper than emergency fixes
* Beat the Rush — Schedule now while our calendar is open
* Peace of Mind — Know your family is protected when storms hit

IF REPAIRS ARE NEEDED:

As a family-owned company, we'll never pressure you into unnecessary work. But if your roof does need attention, we offer instant financing—apply in just 3 minutes and get affordable monthly payments.

>> SCHEDULE YOUR FREE PRE-STORM INSPECTION <<

Protecting homes. Protecting families.

The River City Roofing Solutions Family

P.S. — Already have visible damage? Don't wait—call us today for priority scheduling.

---
River City Roofing Solutions
Family-Owned Storm Damage Experts`,
  },
];

// =============================================================================
// CALENDAR EVENTS
// =============================================================================

export const CALENDAR_EVENTS: CalendarEvent[] = [
  // January 2026
  { id: 'cal-1', date: '2026-01-01', type: 'Social', title: 'New Year Post', description: 'New Year, New Roof—Start 2026 with confidence. Free estimates available!', channel: 'Facebook/Instagram' },
  { id: 'cal-2', date: '2026-01-02', type: 'Email', title: 'Welcome 2026 Newsletter', description: 'New Year promo + financing spotlight', channel: 'Email' },
  { id: 'cal-3', date: '2026-01-03', type: 'Ad', title: 'Launch Financing Campaign', description: 'Launch "roof financing" search campaign', channel: 'Google Ads' },
  { id: 'cal-4', date: '2026-01-04', type: 'Social', title: 'Family Intro Video', description: 'Meet the family behind RCRS', channel: 'Facebook' },
  { id: 'cal-5', date: '2026-01-06', type: 'Social', title: 'Winter Tips Post', description: 'Winter weather can damage your roof. Schedule a FREE inspection today.', channel: 'Facebook' },
  { id: 'cal-6', date: '2026-01-07', type: 'Blog', title: 'Winter Roof Care Article', description: '5 Signs Your Roof Needs Attention This Winter', channel: 'Blog' },
  { id: 'cal-7', date: '2026-01-08', type: 'Social', title: 'Before/After Carousel', description: 'Project showcase with family-owned mention', channel: 'Instagram' },
  { id: 'cal-8', date: '2026-01-09', type: 'Ad', title: 'Ad #2 Launch', description: '3-Minute Financing ad launch', channel: 'Facebook' },
  { id: 'cal-9', date: '2026-01-10', type: 'Email', title: 'Financing Spotlight', description: 'Template #3: Financing Spotlight', channel: 'Email' },
  { id: 'cal-10', date: '2026-01-13', type: 'Social', title: 'Family Values Post', description: 'Family-owned means personal attention. No call centers—just neighbors helping neighbors.', channel: 'Facebook/Instagram' },
  { id: 'cal-11', date: '2026-01-14', type: 'Ad', title: 'Ad #4 Launch', description: 'Storm + Financing combo banner ad', channel: 'Google Display' },
  { id: 'cal-12', date: '2026-01-15', type: 'Blog', title: 'Financing Article', description: 'How Instant Financing Makes Roof Repairs Affordable', channel: 'Blog' },
  { id: 'cal-13', date: '2026-01-20', type: 'Social', title: 'Urgency Post', description: "Don't wait for a leak to become a flood. Get your FREE inspection.", channel: 'Facebook' },
  { id: 'cal-14', date: '2026-01-22', type: 'Ad', title: 'Ad #1 Launch', description: 'Family-Owned brand ad launch', channel: 'Facebook' },
  { id: 'cal-15', date: '2026-01-23', type: 'Blog', title: 'Storm Prep Article', description: 'Preparing Your Roof for Late Winter Storms', channel: 'Blog' },
  { id: 'cal-16', date: '2026-01-31', type: 'Email', title: 'Month End Newsletter', description: 'January recap + February preview', channel: 'Email' },

  // February 2026
  { id: 'cal-17', date: '2026-02-01', type: 'Social', title: 'Love Theme Post', description: 'Show Your Home Some Love This February', channel: 'Facebook/Instagram' },
  { id: 'cal-18', date: '2026-02-02', type: 'Ad', title: 'Ad #7 Launch', description: 'Love Your Home February ad', channel: 'Facebook' },
  { id: 'cal-19', date: '2026-02-03', type: 'Blog', title: 'Home Defense Article', description: "Why Your Roof is Your Home's First Line of Defense", channel: 'Blog' },
  { id: 'cal-20', date: '2026-02-04', type: 'Social', title: 'Family Business Carousel', description: 'What Family-Owned Really Means', channel: 'Instagram' },
  { id: 'cal-21', date: '2026-02-09', type: 'Social', title: "Valentine's Post", description: 'We love Our Customers—Thank you for trusting our family!', channel: 'Facebook/Instagram' },
  { id: 'cal-22', date: '2026-02-14', type: 'Social', title: "Valentine's Appreciation", description: "Special Valentine's appreciation post", channel: 'Instagram/Facebook' },
  { id: 'cal-23', date: '2026-02-15', type: 'Email', title: "Valentine's Newsletter", description: 'We Love Our Customers + special offer', channel: 'Email' },
  { id: 'cal-24', date: '2026-02-18', type: 'Blog', title: 'Financing Guide', description: 'Financing Your Roof: Everything You Need to Know', channel: 'Blog' },
  { id: 'cal-25', date: '2026-02-19', type: 'Ad', title: 'Ad #5 Launch', description: 'Trust Builder Carousel ad', channel: 'Facebook' },
  { id: 'cal-26', date: '2026-02-23', type: 'Social', title: 'Storm Prep Post', description: 'Spring storms are coming. Is your roof ready?', channel: 'Facebook/Instagram' },
  { id: 'cal-27', date: '2026-02-25', type: 'Blog', title: 'Storm Season Article', description: 'March Storm Season: What Homeowners Need to Know', channel: 'Blog' },
  { id: 'cal-28', date: '2026-02-28', type: 'Email', title: 'Pre-Storm Campaign', description: 'Template #4: Pre-Storm Season', channel: 'Email' },

  // March 2026
  { id: 'cal-29', date: '2026-03-01', type: 'Social', title: 'Storm Season Launch', description: 'Storm Season is HERE. Schedule your FREE pre-storm inspection!', channel: 'Facebook/Instagram' },
  { id: 'cal-30', date: '2026-03-02', type: 'Ad', title: 'Ad #3 Launch', description: 'Storm Damage Urgency ad', channel: 'Facebook' },
  { id: 'cal-31', date: '2026-03-03', type: 'Ad', title: 'Ad #8 Launch', description: 'Storm Season Prep ad', channel: 'Facebook' },
  { id: 'cal-32', date: '2026-03-04', type: 'Blog', title: 'Storm Response Article', description: 'What to Do Immediately After Storm Damage', channel: 'Blog' },
  { id: 'cal-33', date: '2026-03-06', type: 'Email', title: 'Storm Alert Campaign', description: 'Template #2: Storm Damage Alert', channel: 'Email' },
  { id: 'cal-34', date: '2026-03-09', type: 'Social', title: 'Insurance Post', description: 'Storm damage? We handle insurance paperwork for you.', channel: 'Facebook' },
  { id: 'cal-35', date: '2026-03-10', type: 'Ad', title: 'Ad #9 Launch', description: 'Insurance Help ad', channel: 'Google' },
  { id: 'cal-36', date: '2026-03-11', type: 'Blog', title: 'Insurance Guide', description: 'Navigating Roof Insurance Claims: A Complete Guide', channel: 'Blog' },
  { id: 'cal-37', date: '2026-03-14', type: 'Email', title: 'Storm Focus Newsletter', description: 'Storm prep checklist + inspection offer', channel: 'Email' },
  { id: 'cal-38', date: '2026-03-16', type: 'Social', title: 'Spring Action Post', description: 'Spring into action—get your roof inspected today!', channel: 'Facebook/Instagram' },
  { id: 'cal-39', date: '2026-03-18', type: 'Blog', title: 'Spring Maintenance', description: 'Spring Roof Maintenance Checklist', channel: 'Blog' },
  { id: 'cal-40', date: '2026-03-20', type: 'Ad', title: 'Ad #10 Launch', description: 'Testimonial ad', channel: 'Facebook' },
  { id: 'cal-41', date: '2026-03-21', type: 'Email', title: 'Spring Nurture', description: 'Spring maintenance guide', channel: 'Email' },
  { id: 'cal-42', date: '2026-03-25', type: 'Blog', title: 'Q2 Preview Article', description: 'Preparing Your Roof for Summer', channel: 'Blog' },
  { id: 'cal-43', date: '2026-03-28', type: 'Email', title: 'Q1 Wrap Newsletter', description: 'Q1 recap + Q2 preview', channel: 'Email' },
  { id: 'cal-44', date: '2026-03-30', type: 'Social', title: 'Month End Post', description: "March storms causing problems? We're here to help—call today.", channel: 'Facebook/Instagram' },
  { id: 'cal-45', date: '2026-03-31', type: 'Email', title: 'Q2 Kickoff', description: 'Q2 preview + ongoing storm response', channel: 'Email' },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function getAdsByPlatform(platform: AdPlatform): Ad[] {
  if (platform === 'All') return ADS;
  return ADS.filter(ad => ad.platform === platform || ad.platform === 'All');
}

export function getEmailsByType(type: EmailType): EmailTemplate[] {
  return EMAILS.filter(email => email.type === type);
}

export function getCalendarEventsByMonth(year: number, month: number): CalendarEvent[] {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  return CALENDAR_EVENTS.filter(event => event.date.startsWith(monthStr));
}

export function getCalendarEventsByType(type: CalendarEventType): CalendarEvent[] {
  return CALENDAR_EVENTS.filter(event => event.type === type);
}

export function getEventTypeColor(type: CalendarEventType): string {
  const colors: Record<CalendarEventType, string> = {
    Social: 'bg-blue-500',
    Email: 'bg-purple-500',
    Blog: 'bg-amber-500',
    Ad: 'bg-lime-500',
    Meeting: 'bg-cyan-500',
  };
  return colors[type] || 'bg-zinc-500';
}

export function getEventTypeBgColor(type: CalendarEventType): string {
  const colors: Record<CalendarEventType, string> = {
    Social: 'bg-blue-500/20 text-blue-400',
    Email: 'bg-purple-500/20 text-purple-400',
    Blog: 'bg-amber-500/20 text-amber-400',
    Ad: 'bg-lime-500/20 text-lime-400',
    Meeting: 'bg-cyan-500/20 text-cyan-400',
  };
  return colors[type] || 'bg-zinc-500/20 text-zinc-400';
}

export function getPlatformColor(platform: AdPlatform): string {
  const colors: Record<AdPlatform, string> = {
    Facebook: 'bg-blue-600',
    Instagram: 'bg-gradient-to-r from-purple-500 to-pink-500',
    Google: 'bg-red-500',
    Print: 'bg-zinc-600',
    All: 'bg-lime-500',
  };
  return colors[platform] || 'bg-zinc-500';
}

export function getFormatIcon(format: AdFormat): string {
  const icons: Record<AdFormat, string> = {
    Image: 'Image',
    Video: 'Video',
    Carousel: 'LayoutGrid',
    Banner: 'RectangleHorizontal',
  };
  return icons[format] || 'FileText';
}
