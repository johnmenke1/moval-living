// Email from moval.living's SES account, "Emma@moval.living" -> john@menke.re by default.
// Verified working 2026-07-25. Read SKILL.md at ../skills/email-moval-living-ses/SKILL.md before changing anything.

require('dotenv').config({path: process.env.HERMES_ENV_PATH || '.env.local'});
require('dotenv').config({path: process.env.HERMES_GLOBAL_ENV_PATH || require('path').join(process.env.USERPROFILE || process.env.HOME, 'AppData', 'Local', 'hermes', 'profiles', 'molly', '.env')});

const nodemailer = require('nodemailer');

const args = process.argv.slice(2);
const flags = new Set();
const flagArgs = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    flags.add(a);
    if (a.includes('=')) {
      flagArgs[a.slice(2, a.indexOf('='))] = a.slice(a.indexOf('=') + 1);
    } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
      // peek for next arg that isn't a flag
      const next = args[i + 1];
      if (['--to', '--cc', '--attach'].includes(a)) {
        flagArgs[a.slice(2)] = next;
        i++;
      }
    }
  } else {
    positional.push(a);
  }
}

const [subject, body] = positional;
if (!subject || !body) {
  console.error('Usage: node scripts/email-moval-living.js "subject" "body" [--html] [--to <addr>] [--cc <addr>...] [--attach <path>...]');
  process.exit(2);
}

const user = process.env.AWS_SES_SMTP_USERNAME;
const pass = process.env.AWS_SES_SMTP_PASSWORD;
const host = process.env.AWS_SES_SMTP_HOST || 'email-smtp.us-west-2.amazonaws.com';
const port = parseInt(process.env.AWS_SES_SMTP_PORT || '587', 10);

if (!user || !pass) {
  console.error(JSON.stringify({ok: false, error: 'AWS_SES_SMTP_USERNAME / AWS_SES_SMTP_PASSWORD missing in env'}));
  process.exit(1);
}

const to = (flagArgs.to || 'john@menke.re').split(',').map(s => s.trim()).filter(Boolean);
const cc = flagArgs.cc ? flagArgs.cc.split(',').map(s => s.trim()).filter(Boolean) : [];
const attachments = (flagArgs.attach ? [flagArgs.attach] : []).filter(Boolean).map(p => ({path: p}));

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: {user, pass},
  tls: {rejectUnauthorized: false},
});

const mail = {
  from: 'Emma@moval.living',
  to: to.join(', '),
  replyTo: 'john@menke.re',
  subject,
  [flags.has('--html') ? 'html' : 'text']: body,
  ...(cc.length ? {cc: cc.join(', ')} : {}),
  ...(attachments.length ? {attachments} : {}),
};

transporter.sendMail(mail)
  .then(info => {
    console.log(JSON.stringify({
      ok: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    }, null, 2));
  })
  .catch(err => {
    console.error(JSON.stringify({ok: false, error: err.message, code: err.code, response: err.response}, null, 2));
    process.exit(1);
  });
