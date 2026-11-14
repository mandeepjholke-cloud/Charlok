import express from 'express'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'
import { GoogleGenAI, Type } from '@google/genai'
import type { AssistantSettings, TranscriptEntry } from './src/types.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

try {
  process.loadEnvFile(path.resolve(__dirname, '.env'))
} catch {
  // .env file is optional; environment variables may be injected directly
}

const PORT = Number(process.env.DEFAULT_APP_PORT) || 3000
const IS_PROD = process.env.NODE_ENV === 'production'

function createGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not set. Select your Gemini API key in Settings > Secrets and tap Apply changes.',
    )
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  })
}

function buildCallAssistantInstruction(params: {
  callerName: string
  callerNumber: string
  settings: AssistantSettings
}): string {
  const { callerName, callerNumber, settings } = params
  const owner = settings.ownerName?.trim() || 'the user'

  const languageRule =
    settings.language === 'punjabi'
      ? 'Speak primarily in natural conversational Punjabi (using simple Roman Punjabi or clear phrasing easy to read aloud).'
      : settings.language === 'hindi'
        ? 'Speak primarily in natural conversational Hindi.'
        : settings.language === 'english'
          ? 'Speak in clear, natural conversational English.'
          : 'Match the language the caller uses (English, Punjabi, or Hindi). If opening the call and a custom greeting is set, match its language; otherwise open politely in English.'

  const modeRule =
    settings.screeningMode === 'strict_spam'
      ? `Screen the caller firmly and politely: verify their full name, organization, and exact reason for calling ${owner}. If it sounds like an unsolicited sales pitch or spam, politely decline and wrap up the call.`
      : settings.screeningMode === 'friendly_receptionist'
        ? `Act as a warm, helpful personal receptionist for ${owner}. Answer general questions politely, collect their message, callback number, and preferred callback time.`
        : `Politely greet the caller, ask who is calling and what the call is regarding so you can take an accurate message for ${owner}, and ask if it is urgent.`

  const greetingNote = settings.customGreeting?.trim()
    ? `Use this preferred opening style: "${settings.customGreeting.trim()}".`
    : `Open by introducing yourself as CHARLOK, ${owner}'s AI call assistant.`

  return [
    `You are CHARLOK, an AI Call Assistant answering an incoming phone call on behalf of ${owner}.`,
    `Caller info on screen: ${callerName || 'Unknown Caller'} (${callerNumber || 'Unknown number'}).`,
    greetingNote,
    modeRule,
    languageRule,
    'Keep each spoken response brief, natural, and conversational (1 to 3 short sentences) just like a real live phone call. Never include markdown, bullet points, emojis, or stage directions.',
  ].join('\n')
}

function formatTranscriptHistory(history: TranscriptEntry[]): string {
  return (history ?? [])
    .filter((item) => item.speaker !== 'system')
    .map(
      (item) =>
        `${item.speaker === 'caller' ? 'Caller' : 'CHARLOK'}: ${item.text}`,
    )
    .join('\n')
}

async function startServer() {
  const app = express()
  app.use(express.json({ limit: '10mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    })
  })

  const APK_CHUNK_SIZE = 16 * 1024 * 1024 // 16 MB per chunk (under 32 MB proxy limit)

  app.get('/api/download/apk-meta', (_req, res) => {
    const apkPath = path.resolve(__dirname, '.build-outputs/app-debug.apk')
    if (!fs.existsSync(apkPath)) {
      res.status(404).json({ available: false, error: 'Starter APK file not found.' })
      return
    }
    const stat = fs.statSync(apkPath)
    const totalChunks = Math.ceil(stat.size / APK_CHUNK_SIZE)
    res.json({
      available: true,
      filename: 'charlok-starter.apk',
      totalBytes: stat.size,
      chunkSize: APK_CHUNK_SIZE,
      totalChunks,
    })
  })

  app.get('/api/download/apk-chunk/:index', (req, res) => {
    const apkPath = path.resolve(__dirname, '.build-outputs/app-debug.apk')
    if (!fs.existsSync(apkPath)) {
      res.status(404).json({ error: 'Starter APK file not found.' })
      return
    }
    const index = Number(req.params.index)
    const stat = fs.statSync(apkPath)
    const totalChunks = Math.ceil(stat.size / APK_CHUNK_SIZE)
    if (!Number.isInteger(index) || index < 0 || index >= totalChunks) {
      res.status(400).json({ error: 'Invalid chunk index.' })
      return
    }
    const start = index * APK_CHUNK_SIZE
    const end = Math.min(stat.size - 1, start + APK_CHUNK_SIZE - 1)
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Length', String(end - start + 1))
    res.setHeader('Cache-Control', 'no-store')
    fs.createReadStream(apkPath, { start, end }).pipe(res)
  })

  app.get('/download/charlok-android-source.zip', (_req, res) => {
    const zipPath = path.resolve(
      __dirname,
      '.build-outputs/charlok-android-source.zip',
    )
    if (!fs.existsSync(zipPath)) {
      res.status(404).json({ error: 'Android source archive not found.' })
      return
    }
    res.setHeader('Content-Type', 'application/zip')
    res.download(zipPath, 'charlok-android-source.zip', { dotfiles: 'allow' })
  })

  // Opening greeting when CHARLOK picks up an inbound call
  app.post('/api/calls/greet', async (req, res) => {
    try {
      const { callerName, callerNumber, settings } = req.body as {
        callerName: string
        callerNumber: string
        settings: AssistantSettings
      }

      const ai = createGenAIClient()
      const systemInstruction = buildCallAssistantInstruction({
        callerName,
        callerNumber,
        settings,
      })

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `The incoming call from ${callerName || 'an unknown caller'} has just been picked up. Say your opening greeting to the caller now in 1-2 short spoken sentences.`,
        config: {
          systemInstruction,
        },
      })

      const greetingText =
        response.text?.trim() ||
        `Hello, this is CHARLOK, ${settings.ownerName || 'the user'}'s AI call assistant. How can I help you today?`

      res.json({ replyText: greetingText })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate call greeting.'
      res.status(500).json({ error: message })
    }
  })

  // Voice audio turn: transcribes caller audio and generates CHARLOK's spoken reply
  app.post('/api/calls/voice-turn', async (req, res) => {
    try {
      const {
        callerName,
        callerNumber,
        audioBase64,
        audioMimeType,
        history,
        settings,
      } = req.body as {
        callerName: string
        callerNumber: string
        audioBase64: string
        audioMimeType: string
        history: TranscriptEntry[]
        settings: AssistantSettings
      }

      if (!audioBase64) {
        res.status(400).json({ error: 'Audio payload is required.' })
        return
      }

      const ai = createGenAIClient()
      const systemInstruction = buildCallAssistantInstruction({
        callerName,
        callerNumber,
        settings,
      })
      const transcriptContext = formatTranscriptHistory(history)

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: audioMimeType || 'audio/webm',
                data: audioBase64,
              },
            },
            {
              text: `${
                transcriptContext
                  ? `Conversation so far:\n${transcriptContext}\n\n`
                  : ''
              }Listen to the caller's latest audio clip. Transcribe what the caller said accurately (if silent or unintelligible background noise, return an empty string for callerTranscript) and provide CHARLOK's natural spoken reply in 1-3 short sentences.`,
            },
          ],
        },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              callerTranscript: {
                type: Type.STRING,
                description:
                  'Exact transcription of what the caller said in the audio clip, or empty string if silent/noise.',
              },
              replyText: {
                type: Type.STRING,
                description:
                  'CHARLOK spoken response to the caller in 1-3 short natural sentences.',
              },
            },
            required: ['callerTranscript', 'replyText'],
          },
        },
      })

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        callerTranscript?: string
        replyText?: string
      }

      res.json({
        callerTranscript: (parsed.callerTranscript ?? '').trim(),
        replyText: (parsed.replyText ?? '').trim(),
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to process caller voice.'
      res.status(500).json({ error: message })
    }
  })

  // Text turn for typed caller messages during an active call
  app.post('/api/calls/reply', async (req, res) => {
    try {
      const {
        callerName,
        callerNumber,
        callerMessage,
        history,
        settings,
      } = req.body as {
        callerName: string
        callerNumber: string
        callerMessage: string
        history: TranscriptEntry[]
        settings: AssistantSettings
      }

      if (!callerMessage?.trim()) {
        res.status(400).json({ error: 'Caller message is required.' })
        return
      }

      const ai = createGenAIClient()
      const systemInstruction = buildCallAssistantInstruction({
        callerName,
        callerNumber,
        settings,
      })

      const transcriptContext = formatTranscriptHistory(history)
      const prompt = transcriptContext
        ? `Conversation so far:\n${transcriptContext}\n\nCaller just said: ${callerMessage}\n\nRespond naturally as CHARLOK in 1-3 short spoken sentences.`
        : `Caller just said: ${callerMessage}\n\nRespond naturally as CHARLOK in 1-3 short spoken sentences.`

      const textResponse = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
        },
      })

      const replyText =
        textResponse.text?.trim() ||
        'Thanks for calling. Let me note your message and pass it along right away.'

      res.json({ replyText })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to generate call reply.'
      res.status(500).json({ error: message })
    }
  })

  // Generate structured call summary when an inbound call ends
  app.post('/api/calls/summarize', async (req, res) => {
    try {
      const { callerName, callerNumber, transcript } = req.body as {
        callerName: string
        callerNumber: string
        transcript: TranscriptEntry[]
      }

      const lines = formatTranscriptHistory(transcript)

      if (!lines) {
        res.json({
          summary: 'Call connected briefly with no spoken conversation.',
          callerIntent: 'No message left',
          urgency: 'low',
          recommendedAction: 'No follow-up needed unless caller calls back.',
          isSpamLikely: false,
        })
        return
      }

      const ai = createGenAIClient()
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Analyze this inbound phone call transcript between the Caller (${callerName}, ${callerNumber}) and CHARLOK (the AI call assistant):\n\n${lines}`,
        config: {
          systemInstruction:
            'Summarize the phone call concisely for the phone owner. Classify urgency as low, medium, or high, and detect likely spam/telemarketing.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: '1-2 sentence summary of what the caller wanted.',
              },
              callerIntent: {
                type: Type.STRING,
                description:
                  'Short label for caller intent (e.g., Delivery, Appointment, Inquiry, Spam).',
              },
              urgency: {
                type: Type.STRING,
                description: 'Must be one of: low, medium, high.',
              },
              recommendedAction: {
                type: Type.STRING,
                description: 'Clear next step for the phone owner.',
              },
              isSpamLikely: {
                type: Type.BOOLEAN,
                description:
                  'True if the call appears to be spam or unsolicited telemarketing.',
              },
            },
            required: [
              'summary',
              'callerIntent',
              'urgency',
              'recommendedAction',
              'isSpamLikely',
            ],
          },
        },
      })

      const parsed = JSON.parse((response.text ?? '{}').trim())
      const urgency =
        parsed.urgency === 'high' ||
        parsed.urgency === 'medium' ||
        parsed.urgency === 'low'
          ? parsed.urgency
          : 'low'

      res.json({
        summary: parsed.summary || 'Call completed.',
        callerIntent: parsed.callerIntent || 'General call',
        urgency,
        recommendedAction: parsed.recommendedAction || 'Review transcript.',
        isSpamLikely: Boolean(parsed.isSpamLikely),
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to summarize call.'
      res.status(500).json({ error: message })
    }
  })

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distDir = path.resolve(__dirname, 'dist')
    app.use(express.static(distDir))
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  const server = http.createServer(app)

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CHARLOK server listening on http://0.0.0.0:${PORT}`)
  })
}

startServer().catch((err) => {
  console.error('Failed to start CHARLOK server:', err)
  process.exit(1)
})
