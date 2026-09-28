import QRCode from 'qrcode'
import { z } from 'zod'

export type ToolExecutionResult = Record<string, unknown>
type ToolDefinition = {
  schema: z.ZodType
  execute: (input: Record<string, unknown>) => Promise<ToolExecutionResult>
}

const phoneSchema = z.string().trim().min(7).max(40).regex(/^[+\d\s().-]+$/, 'Enter a phone number using digits and common separators.')
const linkSchema = z.object({
  phoneNumber: phoneSchema,
  message: z.string().trim().max(1024).optional().default(''),
})

const qrSchema = z.object({
  content: z.string().trim().min(1).max(2048),
  contentType: z.enum(['whatsapp', 'url', 'text', 'email', 'phone', 'wifi']).default('whatsapp'),
  format: z.enum(['png', 'svg']).default('png'),
  size: z.number().int().min(128).max(1024).default(320),
  margin: z.number().int().min(0).max(8).default(2),
})

const messageSchema = z.object({
  businessName: z.string().trim().max(120).optional().default(''),
  customerName: z.string().trim().max(120).optional().default(''),
  productName: z.string().trim().max(160).optional().default(''),
  details: z.string().trim().max(600).optional().default(''),
  amount: z.string().trim().max(80).optional().default(''),
  dueDate: z.string().trim().max(80).optional().default(''),
  returnTime: z.string().trim().max(120).optional().default(''),
  tone: z.enum(['friendly', 'professional', 'concise']).default('friendly'),
})

function normalizePhoneNumber(value: string) {
  if (!/^[+\d\s().-]+$/.test(value)) {
    throw new Error('Enter a valid phone number with country code.')
  }
  const digits = value.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) {
    throw new Error('Phone numbers must contain between 7 and 15 digits.')
  }
  return digits
}

function buildWhatsAppUrl(phoneNumber: string, message: string) {
  const formattedPhoneNumber = normalizePhoneNumber(phoneNumber)
  const url = new URL(`https://wa.me/${formattedPhoneNumber}`)
  if (message) url.searchParams.set('text', message)
  return { whatsappUrl: url.toString(), formattedPhoneNumber, message }
}

function safeQrContent(content: string, contentType: z.infer<typeof qrSchema>['contentType']) {
  const value = content.trim()
  if (contentType === 'whatsapp') {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !['wa.me', 'www.wa.me'].includes(url.hostname)) {
      throw new Error('Enter a valid https://wa.me WhatsApp link.')
    }
    return url.toString()
  }
  if (contentType === 'url') {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Enter a web address that starts with http:// or https://.')
    }
    return url.toString()
  }
  if (contentType === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new Error('Enter a valid email address.')
    }
    return `mailto:${value}`
  }
  if (contentType === 'phone') {
    return `tel:${normalizePhoneNumber(value)}`
  }
  if (contentType === 'wifi') {
    const [ssid, password, ...extra] = value.split('|')
    if (!ssid || extra.length > 0) throw new Error('Enter Wi-Fi details as network name|password. Leave the password blank for an open network.')
    const escapeWifiValue = (part: string) => part.replace(/([\\\\;,:])/g, '\\\\$1')
    return `WIFI:T:${password ? 'WPA' : 'nopass'};S:${escapeWifiValue(ssid)};${password ? `P:${escapeWifiValue(password)};` : ''};`
  }
  return value
}

async function createQrCode(input: z.infer<typeof qrSchema>): Promise<ToolExecutionResult> {
  const payload = safeQrContent(input.content, input.contentType)
  const qrCode = input.format === 'svg'
    ? await QRCode.toString(payload, { type: 'svg', width: input.size, margin: input.margin, errorCorrectionLevel: 'M' })
    : await QRCode.toDataURL(payload, { width: input.size, margin: input.margin, errorCorrectionLevel: 'M' })
  const downloadUrl = input.format === 'svg'
    ? `data:image/svg+xml;base64,${Buffer.from(qrCode).toString('base64')}`
    : qrCode

  return { qrCode: downloadUrl, downloadUrl, format: input.format }
}

function createMessage(slug: string, input: z.infer<typeof messageSchema>): ToolExecutionResult {
  const business = input.businessName || 'our team'
  const customer = input.customerName ? ` ${input.customerName}` : ''
  const product = input.productName || 'your recent purchase'
  const details = input.details ? ` ${input.details}` : ''
  const signoff = input.tone === 'professional' ? `\n\nRegards,\n${business}` : `\n\n— ${business}`
  let message: string
  let suggestedCallToAction = 'Reply here if you have any questions.'

  switch (slug) {
    case 'whatsapp-greeting-message-generator':
      message = `Hi${customer}, thanks for reaching out to ${business}! We’re glad you’re here.${details} How can we help you today?`
      suggestedCallToAction = 'Tell us what you are looking for and we’ll be happy to help.'
      break
    case 'whatsapp-away-message-generator':
      message = `Hi${customer}, thanks for your message. ${business} is away right now.${input.returnTime ? ` We’ll be back ${input.returnTime}.` : ' We’ll get back to you as soon as we can.'}${details}`
      suggestedCallToAction = 'Leave your question here and we’ll follow up when we return.'
      break
    case 'whatsapp-product-description-generator':
      message = `${product}${details ? ` —${details}` : ''}. Get in touch with ${business} to learn more or place an order.`
      suggestedCallToAction = 'Message us to order or ask a question.'
      break
    case 'customer-follow-up-message-generator':
      message = `Hi${customer}, just checking in about ${product}.${details} If there’s anything else you need, ${business} is here to help.`
      suggestedCallToAction = 'Would you like us to help with anything else?'
      break
    case 'payment-reminder-generator':
      message = `Hi${customer}, a quick note from ${business} about your${input.amount ? ` ${input.amount}` : ''} payment for ${product}${input.dueDate ? `, due ${input.dueDate}` : ''}.${details} If you’ve already taken care of it, thank you and please disregard this message.`
      suggestedCallToAction = 'Let us know if you need the payment details again.'
      break
    case 'review-request-generator':
      message = `Hi${customer}, thank you for choosing ${business}${product ? ` for ${product}` : ''}! When you have a moment, we’d love to hear about your experience.${details}`
      suggestedCallToAction = 'Share your feedback whenever it is convenient.'
      break
    default:
      message = `Hi${customer}, ${business} here. ${input.productName ? `We’re reaching out about ${input.productName}. ` : ''}${details || 'We wanted to share a quick update with you.'} Let us know how we can help.`
  }

  if (input.tone === 'concise') {
    message = message.replace(/\s+/g, ' ').trim()
  }
  message += signoff

  return {
    message,
    alternativeMessages: [],
    suggestedCallToAction,
  }
}

const messageTools = [
  'whatsapp-message-template-generator',
  'whatsapp-greeting-message-generator',
  'whatsapp-away-message-generator',
  'whatsapp-product-description-generator',
  'customer-follow-up-message-generator',
  'payment-reminder-generator',
  'review-request-generator',
]

const definitions: Record<string, ToolDefinition> = {
  'whatsapp-link-generator': {
    schema: linkSchema,
    execute: async (input) => buildWhatsAppUrl(input.phoneNumber as string, input.message as string),
  },
  'whatsapp-click-to-chat-generator': {
    schema: linkSchema,
    execute: async (input) => buildWhatsAppUrl(input.phoneNumber as string, input.message as string),
  },
  'whatsapp-qr-generator': {
    schema: qrSchema,
    execute: async (input) => createQrCode(input as z.infer<typeof qrSchema>),
  },
}

for (const slug of messageTools) {
  definitions[slug] = {
    schema: messageSchema,
    execute: async (input) => createMessage(slug, input as z.infer<typeof messageSchema>),
  }
}

export function getToolInputFields(slug: string) {
  if (slug === 'whatsapp-link-generator' || slug === 'whatsapp-click-to-chat-generator') {
    return [
      { name: 'phoneNumber', label: 'Phone number with country code', type: 'tel', required: true, placeholder: '+1 555 123 4567' },
      { name: 'message', label: 'Message (optional)', type: 'textarea', required: false, placeholder: 'Hi, I’d like to learn more.' },
    ]
  }
  if (slug === 'whatsapp-qr-generator') {
    return [
      { name: 'content', label: 'Link, text, or Wi-Fi network|password', type: 'textarea', required: true, placeholder: 'https://wa.me/15551234567' },
      { name: 'contentType', label: 'Content type', type: 'select', required: true, options: ['whatsapp', 'url', 'text', 'email', 'phone', 'wifi'] },
      { name: 'format', label: 'Download format', type: 'select', required: true, options: ['png', 'svg'] },
    ]
  }
  const common = [
    { name: 'businessName', label: 'Business name', type: 'text', required: false, placeholder: 'Your business' },
    { name: 'customerName', label: 'Customer name', type: 'text', required: false, placeholder: 'Alex' },
  ]
  const details = { name: 'details', label: 'A few useful details', type: 'textarea', required: false, placeholder: 'Add context to make the message more personal.' }
  const productName = { name: 'productName', label: 'Product or service', type: 'text', required: false, placeholder: 'Your product or service' }
  const tone = { name: 'tone', label: 'Tone', type: 'select', required: true, options: ['friendly', 'professional', 'concise'] }

  if (slug === 'whatsapp-away-message-generator') {
    return [...common, { name: 'returnTime', label: 'When you’ll be back', type: 'text', required: false, placeholder: 'tomorrow morning' }, details]
  }
  if (slug === 'whatsapp-product-description-generator') return [common[0], productName, details]
  if (slug === 'payment-reminder-generator') {
    return [...common, { name: 'amount', label: 'Amount due', type: 'text', required: false, placeholder: '$45.00' }, { name: 'dueDate', label: 'Due date', type: 'text', required: false, placeholder: 'Friday, October 2' }, productName, details]
  }
  if (slug === 'review-request-generator') return [...common, productName, details]
  if (slug === 'customer-follow-up-message-generator') return [...common, productName, details, tone]
  if (slug === 'whatsapp-greeting-message-generator') return [...common, details]
  return [...common, details, tone]
}

export async function executeTool(slug: string, input: unknown): Promise<ToolExecutionResult> {
  const definition = definitions[slug]
  if (!definition) {
    throw new Error('This tool does not have an execution engine yet.')
  }

  const parsed = definition.schema.safeParse(input)
  if (!parsed.success) {
    throw new ToolInputError('Check the fields and try again.', parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })))
  }

  try {
    return await definition.execute(parsed.data as Record<string, unknown>)
  } catch (error) {
    if (error instanceof ToolInputError) throw error
    throw new ToolInputError(error instanceof Error ? error.message : 'The input could not be processed.')
  }
}

export class ToolInputError extends Error {
  issues: { field: string; message: string }[]

  constructor(message: string, issues: { field: string; message: string }[] = []) {
    super(message)
    this.name = 'ToolInputError'
    this.issues = issues
  }
}

export function isToolSupported(slug: string) {
  return slug in definitions
}
