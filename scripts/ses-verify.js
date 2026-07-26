require('dotenv').config({path:'.env.local'});
const nodemailer = require('nodemailer');
const cfg = {
  host: process.env.AWS_SES_SMTP_HOST || process.env.EMAIL_SERVER_HOST,
  port: parseInt(process.env.AWS_SES_SMTP_PORT || process.env.EMAIL_SERVER_PORT || '587'),
  user: process.env.AWS_SES_SMTP_USER || process.env.EMAIL_SERVER_USER,
  pass: process.env.AWS_SES_SMTP_PASSWORD || process.env.EMAIL_SERVER_PASSWORD,
  sender: process.env.AUTH_EMAIL_FROM || 'Emma@moval.living',
};
console.log(JSON.stringify({
  host: cfg.host,
  port: cfg.port,
  user: cfg.user ? cfg.user.slice(0,4)+'***' : 'MISSING',
  pass: cfg.pass ? 'set' : 'MISSING',
  sender: cfg.sender,
}, null, 2));
if (!cfg.host || !cfg.user || !cfg.pass) { console.log('NOT CONFIGURED'); process.exit(0); }
const t = nodemailer.createTransport({host: cfg.host, port: cfg.port, secure: cfg.port===465, auth:{user: cfg.user, pass: cfg.pass}, tls: {rejectUnauthorized: false}});
t.verify().then(ok => console.log(JSON.stringify({smtpVerify: ok}))).catch(e => console.log(JSON.stringify({smtpVerify: false, error: e.message})));
