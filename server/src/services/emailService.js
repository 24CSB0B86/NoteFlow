'use strict';

const nodemailer = require('nodemailer');

// ── Create Transporter ────────────────────────────────────────────────────────
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  // Support both Gmail and generic SMTP via env vars
  if (process.env.EMAIL_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } else if (process.env.GMAIL_USER) {
    // Gmail shorthand
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASS, // App password, not account password
      },
    });
  } else {
    // Fallback: Ethereal (dev testing)
    console.warn('⚠️  No email config found. Using Ethereal test account (emails not delivered).');
    return null;
  }

  return transporter;
}

// ── HTML Email Template ───────────────────────────────────────────────────────
function buildEmailHTML(userName, title, message, ctaText, ctaLink) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #e5e5e5; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #6c63ff, #a855f7); padding: 32px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 28px; }
    .header p { margin: 8px 0 0; color: rgba(255,255,255,0.8); }
    .body { padding: 32px; }
    .greeting { font-size: 18px; font-weight: 600; margin-bottom: 12px; }
    .message { color: #a3a3a3; line-height: 1.6; margin-bottom: 24px; }
    .cta { display: inline-block; background: linear-gradient(135deg, #6c63ff, #a855f7); color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; }
    .footer { padding: 20px 32px; border-top: 1px solid #2a2a4a; color: #555; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📚 NoteFlow</h1>
      <p>Educational Resource Platform</p>
    </div>
    <div class="body">
      <div class="greeting">Hi ${userName}! 👋</div>
      <h2 style="margin: 0 0 12px; color: #e5e5e5;">${title}</h2>
      <p class="message">${message}</p>
      ${ctaLink ? `<a href="${ctaLink}" class="cta">${ctaText || 'View on NoteFlow'}</a>` : ''}
    </div>
    <div class="footer">
      <p>You're receiving this because you're part of a NoteFlow classroom.</p>
      <p>© ${new Date().getFullYear()} NoteFlow Platform</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ── Generic Notification Email ────────────────────────────────────────────────
async function sendNotificationEmail(toEmail, userName, title, message, ctaText = null, ctaLink = null) {
  const t = getTransporter();
  if (!t) return;

  const appUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const link = ctaLink ? `${appUrl}${ctaLink}` : null;

  await t.sendMail({
    from: `"NoteFlow" <${process.env.EMAIL_FROM || process.env.GMAIL_USER || 'noreply@noteflow.app'}>`,
    to: toEmail,
    subject: `NoteFlow: ${title}`,
    html: buildEmailHTML(userName, title, message, ctaText, link),
  });
}

// ── Weekly Karma Digest ───────────────────────────────────────────────────────
async function sendWeeklyDigest(toEmail, userName, stats) {
  const t = getTransporter();
  if (!t) return;

  const message = `
    Here's your weekly NoteFlow summary:<br><br>
    ⭐ <strong>Points earned this week:</strong> +${stats.weeklyPoints}<br>
    📚 <strong>Resources uploaded:</strong> ${stats.uploads}<br>
    🏅 <strong>Bounties fulfilled:</strong> ${stats.bountiesFulfilled}<br>
    🎯 <strong>Current level:</strong> ${stats.levelName} (${stats.totalPoints} pts)<br><br>
    Keep contributing to climb the leaderboard!
  `;

  await sendNotificationEmail(
    toEmail, userName,
    '📊 Your Weekly NoteFlow Digest',
    message,
    'View Leaderboard',
    '/profile'
  );
}

// ── Bounty Notification Emails ────────────────────────────────────────────────
async function sendBountyClaimedEmail(toEmail, userName, bountyTitle, claimerName) {
  await sendNotificationEmail(
    toEmail, userName,
    `Your bounty was claimed! 🏹`,
    `<strong>${claimerName}</strong> has claimed your bounty "<em>${bountyTitle}</em>". They're working on it now. You'll be notified once they submit a resource.`,
    'View Bounty',
    '/bounties'
  );
}

async function sendBountySubmittedEmail(toEmail, userName, bountyTitle) {
  await sendNotificationEmail(
    toEmail, userName,
    `New submission for your bounty 📬`,
    `A resource has been submitted for your bounty "<em>${bountyTitle}</em>". Please review it and approve or reject the submission.`,
    'Review Submission',
    '/bounties'
  );
}

async function sendBountyApprovedEmail(toEmail, userName, bountyTitle, pointsEarned) {
  await sendNotificationEmail(
    toEmail, userName,
    `Bounty approved! +${pointsEarned} karma ⚡`,
    `Your submission for "<em>${bountyTitle}</em>" has been approved! You've earned <strong>+${pointsEarned} karma points</strong>. Keep it up!`,
    'View Your Profile',
    '/profile'
  );
}

async function sendBountyRejectedEmail(toEmail, userName, bountyTitle, reason) {
  await sendNotificationEmail(
    toEmail, userName,
    `Bounty submission needs revision 📝`,
    `Your submission for "<em>${bountyTitle}</em>" was not approved. Reason: <em>${reason || 'No reason provided'}</em>. The bounty is back to open — you can try again!`,
    'View Bounty',
    '/bounties'
  );
}

async function sendVerificationEmail(toEmail, userName, resourceName, approved, reason = null) {
  if (approved) {
    await sendNotificationEmail(
      toEmail, userName,
      `Resource verified by professor ✅`,
      `Your resource "<em>${resourceName}</em>" has been verified by a professor! You've earned <strong>+15 karma points</strong> and a "Certified" badge.`,
      'View Resource',
      '/classrooms'
    );
  } else {
    await sendNotificationEmail(
      toEmail, userName,
      `Resource verification update 📋`,
      `Your resource "<em>${resourceName}</em>" requires some changes. Reason: <em>${reason || 'Please review and re-upload'}</em>.`,
      'View Resource',
      '/classrooms'
    );
  }
}

module.exports = {
  sendNotificationEmail,
  sendWeeklyDigest,
  sendBountyClaimedEmail,
  sendBountySubmittedEmail,
  sendBountyApprovedEmail,
  sendBountyRejectedEmail,
  sendVerificationEmail,
};
