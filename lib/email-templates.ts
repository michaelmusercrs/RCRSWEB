// Email Templates - Production-ready HTML email templates
// Used with email-service.ts to send branded emails via Google Apps Script
//
// Templates:
// 1. Welcome Email (first login)
// 2. Quote Follow-up (2 days after estimate)
// 3. Job Complete + Review Request (2 days after job done)
// 4. Referral Request (quarterly to past customers)
// 5. Storm Alert (when storms hit service area)

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// ============================================================
// Shared layout wrapper - all templates use this for consistency
// ============================================================
function emailWrapper(content: string, preheaderText?: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>River City Roofing Solutions</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #0a0a0f !important; }
      .content-bg { background-color: #1a1a2e !important; }
    }
    /* Mobile responsive */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .fluid { max-width: 100% !important; height: auto !important; }
      .stack-column { display: block !important; width: 100% !important; max-width: 100% !important; }
      .center-on-narrow { text-align: center !important; display: block !important; margin-left: auto !important; margin-right: auto !important; float: none !important; }
      .padding-mobile { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: Arial, Helvetica, sans-serif;">
  ${preheaderText ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${preheaderText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}
  <center style="width: 100%; background-color: #0a0a0f;">
    <!--[if mso | IE]>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" align="center" style="width:600px;">
    <tr>
    <td>
    <![endif]-->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin: auto; max-width: 600px;" class="email-container">

      <!-- HEADER -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 30px 40px 20px 40px; text-align: center; border-bottom: 3px solid #39FF14;" class="padding-mobile">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="text-align: center;">
                <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1px;">
                  <span style="color: #39FF14;">RIVER CITY</span>
                  <span style="color: #ffffff;"> ROOFING</span>
                </h1>
                <p style="margin: 4px 0 0 0; font-size: 11px; color: #888888; letter-spacing: 3px; text-transform: uppercase;">Solutions</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- BODY CONTENT -->
      ${content}

      <!-- FOOTER -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 30px 40px; border-top: 1px solid #222222;" class="padding-mobile">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="text-align: center; padding-bottom: 15px;">
                <p style="margin: 0; font-size: 14px; color: #39FF14; font-weight: bold;">River City Roofing Solutions</p>
                <p style="margin: 5px 0 0 0; font-size: 13px; color: #aaaaaa;">Family-Owned &amp; Operated in North Alabama</p>
              </td>
            </tr>
            <tr>
              <td style="text-align: center; padding-bottom: 15px;">
                <p style="margin: 0; font-size: 13px; color: #888888;">
                  <a href="tel:+12562748530" style="color: #39FF14; text-decoration: none;">(256) 274-8530</a>
                  &nbsp;&nbsp;|&nbsp;&nbsp;
                  <a href="mailto:rcrs@rivercityroofingsolutions.com" style="color: #39FF14; text-decoration: none;">rcrs@rivercityroofingsolutions.com</a>
                </p>
                <p style="margin: 5px 0 0 0; font-size: 13px; color: #888888;">
                  <a href="https://www.rivercityroofingsolutions.com" style="color: #888888; text-decoration: none;">www.rivercityroofingsolutions.com</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="text-align: center; padding-bottom: 10px;">
                <p style="margin: 0; font-size: 11px; color: #555555;">
                  IKO ROOFPRO Craftsman Premier &bull; Owens Corning Preferred Contractor &bull; BBB A+
                </p>
              </td>
            </tr>
            <tr>
              <td style="text-align: center;">
                <p style="margin: 0; font-size: 11px; color: #555555;">
                  <a href="{{unsubscribe_url}}" style="color: #555555; text-decoration: underline;">Unsubscribe</a>
                  &nbsp;&nbsp;|&nbsp;&nbsp;
                  <a href="https://www.rivercityroofingsolutions.com/privacy" style="color: #555555; text-decoration: underline;">Privacy Policy</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
    <!--[if mso | IE]>
    </td>
    </tr>
    </table>
    <![endif]-->
  </center>
</body>
</html>`;
}

// Reusable CTA button
function ctaButton(text: string, href: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
  <tr>
    <td style="border-radius: 8px; background-color: #39FF14;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:50px;v-text-anchor:middle;width:280px;" arcsize="16%" strokecolor="#39FF14" fillcolor="#39FF14">
      <w:anchorlock/>
      <center style="color:#0a0a0f;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">
        ${text}
      </center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${href}" style="display: inline-block; background-color: #39FF14; color: #0a0a0f; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 8px; text-align: center; mso-padding-alt: 0;">
        ${text}
      </a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`;
}

// Secondary CTA button (outline style)
function ctaButtonSecondary(text: string, href: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
  <tr>
    <td style="border-radius: 8px; border: 2px solid #39FF14;">
      <a href="${href}" style="display: inline-block; color: #39FF14; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: bold; text-decoration: none; padding: 10px 24px; border-radius: 8px; text-align: center;">
        ${text}
      </a>
    </td>
  </tr>
</table>`;
}


// ============================================================
// TEMPLATE 1: Welcome Email (sent on first login)
// ============================================================
export function welcomeEmail(params: {
  customerName: string;
  repName?: string;
  repPhone?: string;
  repEmail?: string;
}): EmailTemplate {
  const firstName = params.customerName.split(' ')[0];
  const repName = params.repName || 'our team';
  const repPhone = params.repPhone || '(256) 274-8530';
  const repEmail = params.repEmail || 'rcrs@rivercityroofingsolutions.com';

  const subject = 'Welcome to River City Roofing Solutions!';

  const html = emailWrapper(`
      <!-- HERO SECTION -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 40px 40px 20px 40px;" class="padding-mobile">
          <h2 style="margin: 0 0 5px 0; font-size: 26px; color: #ffffff; font-weight: 700;">
            Welcome, ${firstName}!
          </h2>
          <p style="margin: 0; font-size: 16px; color: #39FF14; font-weight: 600;">
            You&rsquo;re in great hands with our family.
          </p>
        </td>
      </tr>

      <!-- MAIN CONTENT -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 0 40px;" class="padding-mobile">
          <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 24px; color: #cccccc;">
            Thank you for choosing River City Roofing Solutions! As a family-owned and operated roofing company right here in North Alabama, we take pride in treating every customer like a neighbor.
          </p>
        </td>
      </tr>

      <!-- WHAT TO EXPECT -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 0 40px 10px 40px;" class="padding-mobile">
          <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #39FF14;">Here&rsquo;s What to Expect</h3>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 12px 15px; background-color: #111118; border-radius: 8px; margin-bottom: 8px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="width: 36px; vertical-align: top;">
                      <span style="display: inline-block; width: 28px; height: 28px; background-color: #39FF14; color: #0a0a0f; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; font-size: 14px;">1</span>
                    </td>
                    <td style="vertical-align: top;">
                      <p style="margin: 0; font-size: 14px; color: #ffffff; font-weight: bold;">Free Roof Inspection</p>
                      <p style="margin: 4px 0 0 0; font-size: 13px; color: #999999;">We&rsquo;ll schedule a thorough, no-obligation inspection of your roof at a time that works for you.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td style="height: 8px;"></td></tr>
            <tr>
              <td style="padding: 12px 15px; background-color: #111118; border-radius: 8px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="width: 36px; vertical-align: top;">
                      <span style="display: inline-block; width: 28px; height: 28px; background-color: #39FF14; color: #0a0a0f; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; font-size: 14px;">2</span>
                    </td>
                    <td style="vertical-align: top;">
                      <p style="margin: 0; font-size: 14px; color: #ffffff; font-weight: bold;">Detailed Assessment</p>
                      <p style="margin: 4px 0 0 0; font-size: 13px; color: #999999;">You&rsquo;ll receive a clear report with photos and honest recommendations&mdash;no pressure, no upselling.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td style="height: 8px;"></td></tr>
            <tr>
              <td style="padding: 12px 15px; background-color: #111118; border-radius: 8px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="width: 36px; vertical-align: top;">
                      <span style="display: inline-block; width: 28px; height: 28px; background-color: #39FF14; color: #0a0a0f; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; font-size: 14px;">3</span>
                    </td>
                    <td style="vertical-align: top;">
                      <p style="margin: 0; font-size: 14px; color: #ffffff; font-weight: bold;">Your Custom Estimate</p>
                      <p style="margin: 4px 0 0 0; font-size: 13px; color: #999999;">A straightforward estimate with flexible financing options&mdash;apply in just 3 minutes.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 25px 40px;" class="padding-mobile">
          ${ctaButton('Schedule Your Free Inspection', 'https://www.rivercityroofingsolutions.com/check-my-address')}
        </td>
      </tr>

      <!-- REP CONTACT -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 0 40px 30px 40px;" class="padding-mobile">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #111118; border-radius: 8px; border-left: 4px solid #39FF14;">
            <tr>
              <td style="padding: 18px 20px;">
                <p style="margin: 0 0 5px 0; font-size: 14px; color: #999999;">Your dedicated roofing specialist:</p>
                <p style="margin: 0 0 8px 0; font-size: 17px; color: #ffffff; font-weight: bold;">${repName}</p>
                <p style="margin: 0; font-size: 14px; color: #cccccc;">
                  <a href="tel:${repPhone.replace(/[^+\d]/g, '')}" style="color: #39FF14; text-decoration: none;">${repPhone}</a>
                  &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                  <a href="mailto:${repEmail}" style="color: #39FF14; text-decoration: none;">${repEmail}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
  `, 'Welcome to the River City Roofing family! Here\'s what to expect next.');

  const text = `Welcome, ${firstName}!

You're in great hands with our family.

Thank you for choosing River City Roofing Solutions! As a family-owned and operated roofing company right here in North Alabama, we take pride in treating every customer like a neighbor.

Here's What to Expect:

1. Free Roof Inspection
We'll schedule a thorough, no-obligation inspection of your roof at a time that works for you.

2. Detailed Assessment
You'll receive a clear report with photos and honest recommendations - no pressure, no upselling.

3. Your Custom Estimate
A straightforward estimate with flexible financing options - apply in just 3 minutes.

Schedule Your Free Inspection: https://www.rivercityroofingsolutions.com/check-my-address

Your dedicated roofing specialist:
${repName}
${repPhone}
${repEmail}

---
River City Roofing Solutions
Family-Owned & Operated in North Alabama
(256) 274-8530 | rcrs@rivercityroofingsolutions.com
www.rivercityroofingsolutions.com

IKO ROOFPRO Craftsman Premier | Owens Corning Preferred Contractor | BBB A+

Unsubscribe: {{unsubscribe_url}}`;

  return { subject, html, text };
}


// ============================================================
// TEMPLATE 2: Quote Follow-up (sent 2 days after estimate)
// ============================================================
export function quoteFollowUpEmail(params: {
  customerName: string;
  repName: string;
  repPhone: string;
  repEmail: string;
  estimateAmount?: string;
  projectType?: string;
  inspectionDate?: string;
}): EmailTemplate {
  const firstName = params.customerName.split(' ')[0];
  const estimateDisplay = params.estimateAmount || 'your estimate';
  const projectType = params.projectType || 'your roofing project';
  const inspectionDate = params.inspectionDate || 'your recent inspection';

  const subject = 'Your Roof Estimate from River City Roofing';

  const html = emailWrapper(`
      <!-- HERO -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 40px 40px 20px 40px;" class="padding-mobile">
          <h2 style="margin: 0 0 5px 0; font-size: 26px; color: #ffffff; font-weight: 700;">
            Hi ${firstName}, following up on your estimate
          </h2>
          <p style="margin: 0; font-size: 15px; color: #999999;">
            From ${inspectionDate}
          </p>
        </td>
      </tr>

      <!-- MAIN CONTENT -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 0 40px;" class="padding-mobile">
          <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 24px; color: #cccccc;">
            Thanks again for letting us take a look at your roof. I wanted to follow up on the estimate we discussed for <strong style="color: #ffffff;">${projectType}</strong>.
          </p>
          <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 24px; color: #cccccc;">
            I know choosing a roofing contractor is a big decision, and I want to make sure you have everything you need. Here are a few things to keep in mind:
          </p>
        </td>
      </tr>

      <!-- KEY POINTS -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 0 40px 10px 40px;" class="padding-mobile">
          <!-- Timing -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 14px 15px; background-color: #111118; border-radius: 8px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="width: 30px; vertical-align: top; color: #39FF14; font-size: 18px; font-weight: bold; padding-top: 2px;">&#9200;</td>
                    <td>
                      <p style="margin: 0; font-size: 14px; color: #ffffff; font-weight: bold;">Timing Matters</p>
                      <p style="margin: 4px 0 0 0; font-size: 13px; color: #999999; line-height: 20px;">Storm season is approaching. Addressing roof issues now prevents small problems from becoming expensive emergencies. Insurance claims also have filing deadlines&mdash;don&rsquo;t miss your window.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td style="height: 8px;"></td></tr>
            <!-- Financing -->
            <tr>
              <td style="padding: 14px 15px; background-color: #111118; border-radius: 8px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="width: 30px; vertical-align: top; color: #39FF14; font-size: 18px; font-weight: bold; padding-top: 2px;">&#128176;</td>
                    <td>
                      <p style="margin: 0; font-size: 14px; color: #ffffff; font-weight: bold;">Flexible Financing Available</p>
                      <p style="margin: 4px 0 0 0; font-size: 13px; color: #999999; line-height: 20px;">Apply in just 3 minutes and get a decision fast. We offer affordable monthly payment plans so your budget doesn&rsquo;t hold you back from protecting your home.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td style="height: 8px;"></td></tr>
            <!-- Insurance -->
            <tr>
              <td style="padding: 14px 15px; background-color: #111118; border-radius: 8px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="width: 30px; vertical-align: top; color: #39FF14; font-size: 18px; font-weight: bold; padding-top: 2px;">&#128203;</td>
                    <td>
                      <p style="margin: 0; font-size: 14px; color: #ffffff; font-weight: bold;">We Handle the Insurance Paperwork</p>
                      <p style="margin: 4px 0 0 0; font-size: 13px; color: #999999; line-height: 20px;">If your roof has storm damage, we work directly with your insurance company. We&rsquo;ll be there for the adjuster meeting and advocate for full coverage on your behalf.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      ${params.estimateAmount ? `
      <!-- ESTIMATE SUMMARY BOX -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 15px 40px;" class="padding-mobile">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #111118; border: 1px solid #39FF14; border-radius: 8px;">
            <tr>
              <td style="padding: 20px; text-align: center;">
                <p style="margin: 0 0 5px 0; font-size: 13px; color: #999999; text-transform: uppercase; letter-spacing: 1px;">Your Estimate</p>
                <p style="margin: 0; font-size: 28px; color: #39FF14; font-weight: bold;">${estimateDisplay}</p>
                <p style="margin: 8px 0 0 0; font-size: 13px; color: #999999;">${projectType}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ` : ''}

      <!-- CTA -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 25px 40px 15px 40px;" class="padding-mobile">
          ${ctaButton('Schedule Your Project', `tel:${params.repPhone.replace(/[^+\d]/g, '')}`)}
        </td>
      </tr>
      <tr>
        <td style="background-color: #0a0a0f; padding: 0 40px 10px 40px; text-align: center;" class="padding-mobile">
          <p style="margin: 0; font-size: 13px; color: #999999;">or reply directly to this email</p>
        </td>
      </tr>

      <!-- REP SIGNATURE -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 15px 40px 30px 40px;" class="padding-mobile">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-top: 1px solid #222222;">
            <tr>
              <td style="padding-top: 18px;">
                <p style="margin: 0; font-size: 15px; color: #ffffff; font-weight: bold;">${params.repName}</p>
                <p style="margin: 3px 0 0 0; font-size: 13px; color: #999999;">Roofing Specialist, River City Roofing Solutions</p>
                <p style="margin: 8px 0 0 0; font-size: 13px; color: #cccccc;">
                  <a href="tel:${params.repPhone.replace(/[^+\d]/g, '')}" style="color: #39FF14; text-decoration: none;">${params.repPhone}</a>
                  &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                  <a href="mailto:${params.repEmail}" style="color: #39FF14; text-decoration: none;">${params.repEmail}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
  `, `Following up on your roofing estimate for ${projectType}. Financing available - apply in 3 minutes.`);

  const text = `Hi ${firstName}, following up on your estimate

Thanks again for letting us take a look at your roof. I wanted to follow up on the estimate we discussed for ${projectType}.

I know choosing a roofing contractor is a big decision, and I want to make sure you have everything you need.

Timing Matters
Storm season is approaching. Addressing roof issues now prevents small problems from becoming expensive emergencies. Insurance claims also have filing deadlines - don't miss your window.

Flexible Financing Available
Apply in just 3 minutes and get a decision fast. We offer affordable monthly payment plans so your budget doesn't hold you back from protecting your home.

We Handle the Insurance Paperwork
If your roof has storm damage, we work directly with your insurance company. We'll be there for the adjuster meeting and advocate for full coverage on your behalf.
${params.estimateAmount ? `\nYour Estimate: ${estimateDisplay}\nProject: ${projectType}\n` : ''}
Ready to schedule? Call ${params.repName} at ${params.repPhone} or reply to this email.

${params.repName}
Roofing Specialist, River City Roofing Solutions
${params.repPhone} | ${params.repEmail}

---
River City Roofing Solutions
Family-Owned & Operated in North Alabama
(256) 274-8530 | rcrs@rivercityroofingsolutions.com
www.rivercityroofingsolutions.com

IKO ROOFPRO Craftsman Premier | Owens Corning Preferred Contractor | BBB A+

Unsubscribe: {{unsubscribe_url}}`;

  return { subject, html, text };
}


// ============================================================
// TEMPLATE 3: Job Complete + Review Request (2 days after job)
// ============================================================
export function jobCompleteReviewEmail(params: {
  customerName: string;
  projectType?: string;
  completionDate?: string;
  googleReviewUrl?: string;
}): EmailTemplate {
  const firstName = params.customerName.split(' ')[0];
  const projectType = params.projectType || 'your new roof';
  const reviewUrl = params.googleReviewUrl || 'https://g.page/r/rivercityroofingsolutions/review';

  const subject = "How was your new roof? We'd love your feedback!";

  const html = emailWrapper(`
      <!-- HERO -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 40px 40px 10px 40px; text-align: center;" class="padding-mobile">
          <p style="margin: 0 0 10px 0; font-size: 48px;">&#127968;</p>
          <h2 style="margin: 0 0 5px 0; font-size: 26px; color: #ffffff; font-weight: 700;">
            Your project is complete!
          </h2>
          <p style="margin: 0; font-size: 16px; color: #39FF14; font-weight: 600;">
            Thank you for trusting us with ${projectType}.
          </p>
        </td>
      </tr>

      <!-- MAIN CONTENT -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 20px 40px;" class="padding-mobile">
          <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 24px; color: #cccccc;">
            Hi ${firstName},
          </p>
          <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 24px; color: #cccccc;">
            We hope you&rsquo;re loving ${projectType}! It was a pleasure working with you and your family. As a family-owned business, your satisfaction means everything to us.
          </p>
          <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 24px; color: #cccccc;">
            If you have a moment, we&rsquo;d truly appreciate a quick Google review. Your feedback helps other homeowners in our community find a roofer they can trust.
          </p>
        </td>
      </tr>

      <!-- REVIEW CTA -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 10px 40px 25px 40px;" class="padding-mobile">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #111118; border-radius: 12px; border: 1px solid #222222;">
            <tr>
              <td style="padding: 30px; text-align: center;">
                <p style="margin: 0 0 5px 0; font-size: 36px;">&#11088;&#11088;&#11088;&#11088;&#11088;</p>
                <p style="margin: 0 0 18px 0; font-size: 16px; color: #ffffff; font-weight: bold;">How did we do?</p>
                <p style="margin: 0 0 20px 0; font-size: 13px; color: #999999; line-height: 20px;">
                  Takes less than 2 minutes. Your review helps neighbors find quality roofing.
                </p>
                ${ctaButton('Leave a Google Review', reviewUrl)}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- REFERRAL MENTION -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 0 40px;" class="padding-mobile">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #111118; border-radius: 8px; border-left: 4px solid #39FF14;">
            <tr>
              <td style="padding: 18px 20px;">
                <p style="margin: 0 0 8px 0; font-size: 15px; color: #39FF14; font-weight: bold;">
                  Raise the Roof for Schools
                </p>
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #cccccc; line-height: 22px;">
                  Know someone who needs a roof? For every referral that becomes a project, we donate <strong style="color: #ffffff;">$250 to a local school of your choice</strong>.
                </p>
                <p style="margin: 0; font-size: 13px; color: #999999;">
                  Just have them mention your name when they call, or reply to this email with their info.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- WARRANTY REMINDER -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 20px 40px 30px 40px;" class="padding-mobile">
          <p style="margin: 0; font-size: 13px; color: #888888; line-height: 20px;">
            <strong style="color: #aaaaaa;">Warranty reminder:</strong> Your workmanship warranty is active. If you ever notice an issue with your roof, don&rsquo;t hesitate to call us at <a href="tel:+12562748530" style="color: #39FF14; text-decoration: none;">(256) 274-8530</a>. We stand behind our work.
          </p>
        </td>
      </tr>
  `, `Your roof project is complete! We'd love your feedback - leave a quick Google review.`);

  const text = `Your project is complete!

Hi ${firstName},

We hope you're loving ${projectType}! It was a pleasure working with you and your family. As a family-owned business, your satisfaction means everything to us.

If you have a moment, we'd truly appreciate a quick Google review. Your feedback helps other homeowners in our community find a roofer they can trust.

Leave a Google Review: ${reviewUrl}
(Takes less than 2 minutes)

---

RAISE THE ROOF FOR SCHOOLS
Know someone who needs a roof? For every referral that becomes a project, we donate $250 to a local school of your choice. Just have them mention your name when they call, or reply to this email with their info.

---

WARRANTY REMINDER: Your workmanship warranty is active. If you ever notice an issue with your roof, don't hesitate to call us at (256) 274-8530. We stand behind our work.

---
River City Roofing Solutions
Family-Owned & Operated in North Alabama
(256) 274-8530 | rcrs@rivercityroofingsolutions.com
www.rivercityroofingsolutions.com

IKO ROOFPRO Craftsman Premier | Owens Corning Preferred Contractor | BBB A+

Unsubscribe: {{unsubscribe_url}}`;

  return { subject, html, text };
}


// ============================================================
// TEMPLATE 4: Referral Request (quarterly to past customers)
// ============================================================
export function referralRequestEmail(params: {
  customerName: string;
  completedProjectDate?: string;
}): EmailTemplate {
  const firstName = params.customerName.split(' ')[0];

  const subject = 'Know someone who needs a roof? $250 donated in your name!';

  const html = emailWrapper(`
      <!-- HERO -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 40px 40px 10px 40px; text-align: center;" class="padding-mobile">
          <h2 style="margin: 0 0 5px 0; font-size: 26px; color: #ffffff; font-weight: 700;">
            Raise the Roof
            <span style="color: #39FF14;"> for Schools</span>
          </h2>
          <p style="margin: 8px 0 0 0; font-size: 16px; color: #cccccc;">
            Help a neighbor. Help a school. It&rsquo;s that simple.
          </p>
        </td>
      </tr>

      <!-- MAIN CONTENT -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 20px 40px;" class="padding-mobile">
          <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 24px; color: #cccccc;">
            Hi ${firstName},
          </p>
          <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 24px; color: #cccccc;">
            Thank you for being part of the River City Roofing family! We loved working on your home, and we hope your roof is keeping you safe and dry.
          </p>
          <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 24px; color: #cccccc;">
            We&rsquo;d love your help reaching more homeowners in our community. And when you refer someone, you&rsquo;re not just helping them&mdash;you&rsquo;re helping local schools too.
          </p>
        </td>
      </tr>

      <!-- HOW IT WORKS -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 0 40px;" class="padding-mobile">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #111118; border-radius: 12px; border: 1px solid #222222;">
            <tr>
              <td style="padding: 25px 25px 10px 25px; text-align: center;">
                <h3 style="margin: 0 0 20px 0; font-size: 18px; color: #39FF14;">How It Works</h3>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 25px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #222222;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="width: 40px; vertical-align: middle;">
                            <span style="display: inline-block; width: 32px; height: 32px; background-color: #39FF14; color: #0a0a0f; border-radius: 50%; text-align: center; line-height: 32px; font-weight: bold; font-size: 15px;">1</span>
                          </td>
                          <td style="vertical-align: middle;">
                            <p style="margin: 0; font-size: 15px; color: #ffffff;">You refer a friend, neighbor, or family member</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #222222;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="width: 40px; vertical-align: middle;">
                            <span style="display: inline-block; width: 32px; height: 32px; background-color: #39FF14; color: #0a0a0f; border-radius: 50%; text-align: center; line-height: 32px; font-weight: bold; font-size: 15px;">2</span>
                          </td>
                          <td style="vertical-align: middle;">
                            <p style="margin: 0; font-size: 15px; color: #ffffff;">They get a free roof inspection from our team</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #222222;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="width: 40px; vertical-align: middle;">
                            <span style="display: inline-block; width: 32px; height: 32px; background-color: #39FF14; color: #0a0a0f; border-radius: 50%; text-align: center; line-height: 32px; font-weight: bold; font-size: 15px;">3</span>
                          </td>
                          <td style="vertical-align: middle;">
                            <p style="margin: 0; font-size: 15px; color: #ffffff;">If they become a customer, we donate <strong style="color: #39FF14;">$250</strong> to a local school</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="width: 40px; vertical-align: middle;">
                            <span style="display: inline-block; width: 32px; height: 32px; background-color: #39FF14; color: #0a0a0f; border-radius: 50%; text-align: center; line-height: 32px; font-weight: bold; font-size: 15px;">4</span>
                          </td>
                          <td style="vertical-align: middle;">
                            <p style="margin: 0; font-size: 15px; color: #ffffff;"><strong style="color: #39FF14;">You choose the school</strong> that receives the donation</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 25px 25px 25px; text-align: center;">
                <p style="margin: 0; font-size: 13px; color: #999999; line-height: 20px;">
                  No limit on referrals. Every roof helps a school.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 30px 40px 15px 40px;" class="padding-mobile">
          ${ctaButton('Refer a Neighbor', 'https://www.rivercityroofingsolutions.com/referral-rewards')}
        </td>
      </tr>
      <tr>
        <td style="background-color: #0a0a0f; padding: 0 40px 10px 40px; text-align: center;" class="padding-mobile">
          <p style="margin: 0; font-size: 13px; color: #999999; line-height: 20px;">
            Or simply reply to this email with their name and phone number.
          </p>
        </td>
      </tr>

      <!-- EASY SHARE -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 10px 40px 30px 40px;" class="padding-mobile">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #111118; border-radius: 8px;">
            <tr>
              <td style="padding: 18px 20px; text-align: center;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #ffffff; font-weight: bold;">Easy to share:</p>
                <p style="margin: 0; font-size: 13px; color: #999999; line-height: 22px;">
                  &ldquo;Hey, I just got my roof done by River City Roofing. Family-owned, great work, and they donate $250 to a local school when you mention my name. Check them out: <span style="color: #39FF14;">rivercityroofingsolutions.com</span>&rdquo;
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
  `, `Know someone who needs a roof? We'll donate $250 to a local school in your name for every referral.`);

  const text = `RAISE THE ROOF FOR SCHOOLS
Help a neighbor. Help a school. It's that simple.

Hi ${firstName},

Thank you for being part of the River City Roofing family! We loved working on your home, and we hope your roof is keeping you safe and dry.

We'd love your help reaching more homeowners in our community. And when you refer someone, you're not just helping them - you're helping local schools too.

HOW IT WORKS:

1. You refer a friend, neighbor, or family member
2. They get a free roof inspection from our team
3. If they become a customer, we donate $250 to a local school
4. You choose the school that receives the donation

No limit on referrals. Every roof helps a school.

Refer a Neighbor: https://www.rivercityroofingsolutions.com/referral-rewards

Or simply reply to this email with their name and phone number.

Easy to share:
"Hey, I just got my roof done by River City Roofing. Family-owned, great work, and they donate $250 to a local school when you mention my name. Check them out: rivercityroofingsolutions.com"

---
River City Roofing Solutions
Family-Owned & Operated in North Alabama
(256) 274-8530 | rcrs@rivercityroofingsolutions.com
www.rivercityroofingsolutions.com

IKO ROOFPRO Craftsman Premier | Owens Corning Preferred Contractor | BBB A+

Unsubscribe: {{unsubscribe_url}}`;

  return { subject, html, text };
}


// ============================================================
// TEMPLATE 5: Storm Alert (sent when storms hit service area)
// ============================================================
export function stormAlertEmail(params: {
  recipientName?: string;
  stormDate?: string;
  stormType?: string;
  affectedAreas?: string[];
}): EmailTemplate {
  const firstName = params.recipientName ? params.recipientName.split(' ')[0] : 'Neighbor';
  const stormDate = params.stormDate || 'recently';
  const stormType = params.stormType || 'Severe storms';
  const areas = params.affectedAreas || ['North Alabama'];
  const areaList = areas.join(', ');

  const subject = 'Storm Alert: Free Roof Inspection Available';

  const html = emailWrapper(`
      <!-- ALERT BANNER -->
      <tr>
        <td style="background-color: #1a0a00; padding: 15px 40px; text-align: center; border-bottom: 2px solid #ff6600;" class="padding-mobile">
          <p style="margin: 0; font-size: 14px; color: #ff9944; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
            &#9888;&#65039; Storm Damage Alert &bull; ${areaList}
          </p>
        </td>
      </tr>

      <!-- HERO -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 30px 40px 15px 40px;" class="padding-mobile">
          <h2 style="margin: 0 0 5px 0; font-size: 26px; color: #ffffff; font-weight: 700;">
            ${stormType} hit ${areaList}
          </h2>
          <p style="margin: 0; font-size: 15px; color: #cccccc;">
            ${stormDate !== 'recently' ? `Reported: ${stormDate}` : 'Your roof may have hidden damage.'}
          </p>
        </td>
      </tr>

      <!-- MAIN CONTENT -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 10px 40px;" class="padding-mobile">
          <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 24px; color: #cccccc;">
            Hi ${firstName},
          </p>
          <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 24px; color: #cccccc;">
            ${stormType} can cause serious roof damage that isn&rsquo;t visible from the ground. Cracked shingles, dented flashing, and hail impacts often go unnoticed until they cause leaks, mold, or structural problems weeks later.
          </p>
          <p style="margin: 0 0 10px 0; font-size: 15px; line-height: 24px; color: #cccccc; font-weight: bold;">
            We&rsquo;re offering <span style="color: #39FF14;">free roof inspections</span> to homeowners in the affected area.
          </p>
        </td>
      </tr>

      <!-- DAMAGE SIGNS -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 10px 40px;" class="padding-mobile">
          <h3 style="margin: 0 0 15px 0; font-size: 17px; color: #ffffff;">Signs of Storm Damage to Watch For</h3>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding: 10px 15px; background-color: #111118; border-radius: 8px 8px 0 0; border-bottom: 1px solid #1a1a2e;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="width: 24px; vertical-align: middle; color: #39FF14; font-size: 14px;">&#10003;</td>
                    <td style="font-size: 14px; color: #cccccc; line-height: 20px;">Missing, cracked, or curling shingles</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 15px; background-color: #111118; border-bottom: 1px solid #1a1a2e;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="width: 24px; vertical-align: middle; color: #39FF14; font-size: 14px;">&#10003;</td>
                    <td style="font-size: 14px; color: #cccccc; line-height: 20px;">Granules in gutters or on the ground</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 15px; background-color: #111118; border-bottom: 1px solid #1a1a2e;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="width: 24px; vertical-align: middle; color: #39FF14; font-size: 14px;">&#10003;</td>
                    <td style="font-size: 14px; color: #cccccc; line-height: 20px;">Dents on metal flashing, vents, or gutters</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 15px; background-color: #111118; border-bottom: 1px solid #1a1a2e;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="width: 24px; vertical-align: middle; color: #39FF14; font-size: 14px;">&#10003;</td>
                    <td style="font-size: 14px; color: #cccccc; line-height: 20px;">Water stains on ceilings or in the attic</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 15px; background-color: #111118; border-bottom: 1px solid #1a1a2e;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="width: 24px; vertical-align: middle; color: #39FF14; font-size: 14px;">&#10003;</td>
                    <td style="font-size: 14px; color: #cccccc; line-height: 20px;">Damaged or missing ridge caps</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 15px; background-color: #111118; border-radius: 0 0 8px 8px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="width: 24px; vertical-align: middle; color: #39FF14; font-size: 14px;">&#10003;</td>
                    <td style="font-size: 14px; color: #cccccc; line-height: 20px;">Debris impact marks on siding or windows</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- FREE INSPECTION BOX -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 20px 40px;" class="padding-mobile">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #111118; border: 2px solid #39FF14; border-radius: 12px;">
            <tr>
              <td style="padding: 25px; text-align: center;">
                <h3 style="margin: 0 0 10px 0; font-size: 20px; color: #39FF14;">FREE Storm Damage Inspection</h3>
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #cccccc; line-height: 22px;">
                  Our certified inspectors will check your entire roof, document any damage with photos, and provide a detailed report&mdash;completely free.
                </p>
                <p style="margin: 0 0 5px 0; font-size: 13px; color: #999999;">
                  If repairs are needed, we handle the insurance claim process for you.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 10px 40px 15px 40px;" class="padding-mobile">
          ${ctaButton('Check My Address for Storm Damage', 'https://www.rivercityroofingsolutions.com/check-my-address')}
        </td>
      </tr>
      <tr>
        <td style="background-color: #0a0a0f; padding: 0 40px 10px 40px; text-align: center;" class="padding-mobile">
          ${ctaButtonSecondary('Call Now: (256) 274-8530', 'tel:+12562748530')}
        </td>
      </tr>

      <!-- URGENCY NOTE -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 15px 40px 30px 40px;" class="padding-mobile">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #1a0a00; border-radius: 8px; border-left: 4px solid #ff6600;">
            <tr>
              <td style="padding: 15px 18px;">
                <p style="margin: 0; font-size: 13px; color: #ffcc88; line-height: 20px;">
                  <strong>Time-sensitive:</strong> Most homeowners insurance policies require storm damage claims to be filed within 1 year of the storm event. Don&rsquo;t wait until a small issue becomes a costly repair.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
  `, `${stormType} reported in ${areaList}. Your roof may have hidden damage. Free inspections available now.`);

  const text = `STORM DAMAGE ALERT - ${areaList.toUpperCase()}

${stormType} hit ${areaList}

Hi ${firstName},

${stormType} can cause serious roof damage that isn't visible from the ground. Cracked shingles, dented flashing, and hail impacts often go unnoticed until they cause leaks, mold, or structural problems weeks later.

We're offering FREE roof inspections to homeowners in the affected area.

SIGNS OF STORM DAMAGE TO WATCH FOR:
- Missing, cracked, or curling shingles
- Granules in gutters or on the ground
- Dents on metal flashing, vents, or gutters
- Water stains on ceilings or in the attic
- Damaged or missing ridge caps
- Debris impact marks on siding or windows

FREE STORM DAMAGE INSPECTION
Our certified inspectors will check your entire roof, document any damage with photos, and provide a detailed report - completely free. If repairs are needed, we handle the insurance claim process for you.

Check My Address: https://www.rivercityroofingsolutions.com/check-my-address
Call Now: (256) 274-8530

TIME-SENSITIVE: Most homeowners insurance policies require storm damage claims to be filed within 1 year of the storm event. Don't wait until a small issue becomes a costly repair.

---
River City Roofing Solutions
Family-Owned & Operated in North Alabama
(256) 274-8530 | rcrs@rivercityroofingsolutions.com
www.rivercityroofingsolutions.com

IKO ROOFPRO Craftsman Premier | Owens Corning Preferred Contractor | BBB A+

Unsubscribe: {{unsubscribe_url}}`;

  return { subject, html, text };
}


// ============================================================
// CONVENIENCE: Get all template names/descriptions for UI
// ============================================================
export const EMAIL_TEMPLATE_CATALOG = [
  {
    id: 'welcome',
    name: 'Welcome Email',
    description: 'Sent on first login/contact. Branded intro with what to expect and scheduling CTA.',
    trigger: 'First login or form submission',
    fn: welcomeEmail,
  },
  {
    id: 'quote-followup',
    name: 'Quote Follow-up',
    description: 'Sent 2 days after estimate. References their specific project with urgency and financing.',
    trigger: '2 days after estimate',
    fn: quoteFollowUpEmail,
  },
  {
    id: 'job-complete-review',
    name: 'Job Complete + Review Request',
    description: 'Sent 2 days after job completion. Thanks customer and asks for Google review + referral mention.',
    trigger: '2 days after job complete',
    fn: jobCompleteReviewEmail,
  },
  {
    id: 'referral-request',
    name: 'Referral Request',
    description: 'Quarterly email to past customers about Raise the Roof for Schools referral program.',
    trigger: 'Quarterly to past customers',
    fn: referralRequestEmail,
  },
  {
    id: 'storm-alert',
    name: 'Storm Alert',
    description: 'Sent when storms hit service area. Damage signs checklist + free inspection CTA.',
    trigger: 'When storms hit service area',
    fn: stormAlertEmail,
  },
] as const;
