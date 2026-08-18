// Try to read recent messages from #emma1
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN
if (!SLACK_BOT_TOKEN) {
  console.log('No SLACK_BOT_TOKEN — trying with what we have')
  // Use the same webhook approach to check delivery via Slack history
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    console.log('No webhook either — skipping')
    process.exit(0)
  }
  console.log('Webhook:', webhookUrl.slice(0, 50))
}
// Just check recent messages from #emma1 using web API
