import net from 'node:net'
import tls from 'node:tls'
import { getPool } from '../db/pool.js'
import { env } from '../config/env.js'
import { decryptSecret } from './secretVault.js'

const CRLF = '\r\n'

const encodeBase64 = value => Buffer.from(String(value || ''), 'utf8').toString('base64')

const normalizeRecipients = recipients => {
  const source = Array.isArray(recipients) ? recipients.join(',') : String(recipients || '')
  const seen = new Set()
  return source
    .split(/[,;\n]+/)
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => {
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const normalizeHost = value => {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return new URL(text).hostname
  return text.split('/')[0].split(':')[0].trim()
}

const readSmtpResponse = socket => new Promise((resolve, reject) => {
  let buffer = ''
  const cleanup = () => {
    socket.off('data', onData)
    socket.off('error', onError)
    socket.off('close', onClose)
  }
  const onData = chunk => {
    buffer += chunk.toString('utf8')
    if (buffer.length > 65536) {
      cleanup()
      reject(new Error('SMTP response exceeded 64 KB.'))
      return
    }
    const lines = buffer.split(/\r?\n/).filter(Boolean)
    const last = lines[lines.length - 1] || ''
    if (/^\d{3} /.test(last)) {
      cleanup()
      const code = Number(last.slice(0, 3))
      resolve({ code, text: lines.join('\n') })
    }
  }
  const onError = error => {
    cleanup()
    reject(error)
  }
  const onClose = () => {
    cleanup()
    reject(new Error('SMTP connection closed before a complete response was received.'))
  }
  socket.once('error', onError)
  socket.once('close', onClose)
  socket.on('data', onData)
})

const writeSmtp = async (socket, command, expected = [250]) => {
  const responsePromise = readSmtpResponse(socket)
  socket.write(`${command}${CRLF}`)
  const response = await responsePromise
  if (!expected.includes(response.code)) {
    throw new Error(`SMTP command failed (${response.code}): ${response.text}`)
  }
  return response
}

const connectSocket = ({ host, port, secure }) => new Promise((resolve, reject) => {
  const socket = secure ? tls.connect({ host, port, servername: host, rejectUnauthorized: env.smtpTlsRejectUnauthorized }) : net.connect({ host, port })
  const event = secure ? 'secureConnect' : 'connect'
  const cleanup = () => {
    socket.off(event, onConnect)
    socket.off('error', onError)
  }
  const onConnect = () => {
    cleanup()
    resolve(socket)
  }
  const onError = error => {
    cleanup()
    reject(error)
  }
  socket.setTimeout(15000)
  socket.once(event, onConnect)
  socket.once('timeout', () => {
    socket.destroy(new Error(`Connection to ${host}:${port} timed out.`))
  })
  socket.once('error', onError)
})

const upgradeToTls = (socket, host) => new Promise((resolve, reject) => {
  const secureSocket = tls.connect({ socket, servername: host, rejectUnauthorized: env.smtpTlsRejectUnauthorized })
  const cleanup = () => {
    secureSocket.off('secureConnect', onConnect)
    secureSocket.off('error', onError)
  }
  const onConnect = () => {
    cleanup()
    resolve(secureSocket)
  }
  const onError = error => {
    cleanup()
    reject(error)
  }
  secureSocket.once('secureConnect', onConnect)
  secureSocket.once('error', onError)
})

const buildMessage = ({ from, recipients, subject, text }) => [
  `From: ${from}`,
  `To: ${recipients.join(', ')}`,
  `Subject: ${subject}`,
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  '',
  String(text || '')
].join(CRLF)

const sendViaSmtp = async ({ connector, recipients, subject, text }) => {
  const encryption = String(connector.encryption || '').toUpperCase()
  const host = normalizeHost(connector.host_endpoint)
  const port = Number(connector.port) || (encryption === 'SSL' ? 465 : 587)
  const from = String(connector.sender_value || connector.username_value || '').trim()
  if (!host) throw new Error('SMTP host is required.')
  if (!from) throw new Error('Sender is required.')
  if (!recipients.length) throw new Error('At least one recipient is required.')

  let socket = await connectSocket({ host, port, secure: encryption === 'SSL' })
  try {
    await readSmtpResponse(socket)
    await writeSmtp(socket, 'EHLO cafm.local')

    if (encryption === 'TLS') {
      await writeSmtp(socket, 'STARTTLS', [220])
      socket = await upgradeToTls(socket, host)
      await writeSmtp(socket, 'EHLO cafm.local')
    }

    if (connector.username_value && connector.secret_value) {
      await writeSmtp(socket, 'AUTH LOGIN', [334])
      await writeSmtp(socket, encodeBase64(connector.username_value), [334])
      await writeSmtp(socket, encodeBase64(connector.secret_value), [235])
    }

    await writeSmtp(socket, `MAIL FROM:<${from}>`)
    for (const recipient of recipients) {
      await writeSmtp(socket, `RCPT TO:<${recipient}>`, [250, 251])
    }
    await writeSmtp(socket, 'DATA', [354])
    socket.write(`${buildMessage({ from, recipients, subject, text })}${CRLF}.${CRLF}`)
    const queued = await readSmtpResponse(socket)
    if (![250, 251].includes(queued.code)) throw new Error(`SMTP message rejected (${queued.code}): ${queued.text}`)
    await writeSmtp(socket, 'QUIT', [221, 250])
  } finally {
    socket.destroy()
  }
}

export const sendEmailNotification = async ({ connectorName, recipients, subject, text }) => {
  const recipientList = normalizeRecipients(recipients)
  const pool = await getPool()
  const request = pool.request()
  const result = await request
    .input('connectorName', connectorName || '')
    .query(`
      select top 1 connector_name, connector_type, host_endpoint, port, encryption, username_value, secret_value, sender_value, status
      from dbo.smtp_sms_connectors
      where upper(isnull(status, 'Active')) = 'ACTIVE'
        and upper(connector_type) in ('SMTP', 'EMAIL')
        and (@connectorName = '' or connector_name = @connectorName)
      order by case when connector_name = @connectorName then 0 else 1 end, connector_name
    `)
  const connector = result.recordset[0]
  if (!connector) throw new Error('No active SMTP connector is configured.')
  await sendViaSmtp({ connector: { ...connector, secret_value: decryptSecret(connector.secret_value) }, recipients: recipientList, subject, text })
  return { connectorName: connector.connector_name, sentCount: recipientList.length }
}

export { normalizeRecipients }
