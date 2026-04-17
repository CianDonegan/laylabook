const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_PHONE_NUMBER

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { to, message } = req.body

  console.log('ACCOUNT SID:', accountSid ? accountSid.slice(0, 6) + '...' : 'MISSING')
  console.log('AUTH TOKEN:', authToken ? authToken.slice(0, 6) + '...' : 'MISSING')
  console.log('FROM NUMBER:', fromNumber || 'MISSING')
  console.log('TO:', to)

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ To: to, From: fromNumber, Body: message })
  })

  const data = await response.json()
  console.log('TWILIO RESPONSE:', JSON.stringify(data))

  if (data.error_code) {
    return res.status(400).json({ error: data.message })
  }

  return res.status(200).json({ success: true })
}
