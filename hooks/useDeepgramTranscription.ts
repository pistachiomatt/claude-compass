/**
 * Deepgram Live Transcription Hook
 *
 * Manages real-time speech-to-text transcription using Deepgram's WebSocket API.
 * Handles microphone access, audio streaming, transcript accumulation, and audio level monitoring.
 */

import { useState, useRef, useCallback, useEffect } from "react"
import { trpc } from "@/lib/trpc/client"

interface UseDeepgramTranscriptionOptions {
  onTranscript?: (transcript: string, isFinal: boolean) => void
  onError?: (error: string) => void
  onVolumeChange?: (volume: number) => void
}

interface DeepgramTranscriptionState {
  isListening: boolean
  isConnecting: boolean
  transcript: string
  error: string | null
  volume: number
}

interface DeepgramResponse {
  type: string
  channel: {
    alternatives: Array<{
      transcript: string
      confidence: number
    }>
  }
  is_final: boolean
  speech_final: boolean
}

export function useDeepgramTranscription(options: UseDeepgramTranscriptionOptions = {}) {
  const { onTranscript, onError, onVolumeChange } = options

  const [state, setState] = useState<DeepgramTranscriptionState>({
    isListening: false,
    isConnecting: false,
    transcript: "",
    error: null,
    volume: 0,
  })

  const socketRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const transcriptRef = useRef("")
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Get Deepgram API key from server
  const { data: config } = trpc.config.getDeepgramConfig.useQuery()

  // Cleanup function
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null

    if (socketRef.current) {
      socketRef.current.close()
    }
    socketRef.current = null

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    streamRef.current = null

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    analyserRef.current = null

    setState(prev => ({ ...prev, volume: 0 }))
  }, [])

  // Start listening
  const startListening = useCallback(async () => {
    if (!config?.apiKey) {
      const errorMsg = "Deepgram API key not configured"
      setState(prev => ({ ...prev, error: errorMsg }))
      onError?.(errorMsg)
      return
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }))
    transcriptRef.current = ""

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          noiseSuppression: true,
          echoCancellation: true,
        },
      })
      streamRef.current = stream

      // Create WebSocket connection to Deepgram
      const socket = new WebSocket(
        "wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true",
        ["token", config.apiKey],
      )
      socketRef.current = socket

      socket.onopen = () => {
        setState(prev => ({ ...prev, isConnecting: false, isListening: true }))

        // Set up audio analysis for volume monitoring
        const audioContext = new AudioContext()
        audioContextRef.current = audioContext
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        analyserRef.current = analyser

        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)

        // Start volume monitoring loop
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        let frameCount = 0
        const updateVolume = () => {
          if (!analyserRef.current) return

          analyserRef.current.getByteFrequencyData(dataArray)

          // Calculate average volume (0-255) and normalize to 0-1
          const sum = dataArray.reduce((a, b) => a + b, 0)
          const average = sum / dataArray.length
          const normalizedVolume = Math.min(average / 128, 1) // Normalize and cap at 1

          // Debug logging every 30 frames (~0.5s)
          frameCount++
          if (frameCount % 30 === 0) {
            const max = Math.max(...dataArray)
            console.log("[Deepgram Audio]", {
              average: average.toFixed(2),
              max,
              normalized: normalizedVolume.toFixed(3),
              binCount: analyser.frequencyBinCount,
              sampleRate: audioContext.sampleRate,
            })
          }

          setState(prev => ({ ...prev, volume: normalizedVolume }))
          onVolumeChange?.(normalizedVolume)

          animationFrameRef.current = requestAnimationFrame(updateVolume)
        }
        updateVolume()

        // Create MediaRecorder and start streaming
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
        })
        mediaRecorderRef.current = mediaRecorder

        mediaRecorder.addEventListener("dataavailable", event => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data)
          }
        })

        // Start recording with 250ms timeslice for low latency
        mediaRecorder.start(250)
      }

      socket.onmessage = message => {
        try {
          const data: DeepgramResponse = JSON.parse(message.data)
          if (data.type === "Results" && data.channel?.alternatives?.[0]) {
            const transcript = data.channel.alternatives[0].transcript

            if (transcript) {
              if (data.is_final) {
                // Append final transcript with space
                transcriptRef.current = transcriptRef.current
                  ? `${transcriptRef.current} ${transcript}`
                  : transcript

                setState(prev => ({ ...prev, transcript: transcriptRef.current }))
                onTranscript?.(transcriptRef.current, true)
              } else {
                // Show interim results (current final + interim)
                const interimTranscript = transcriptRef.current
                  ? `${transcriptRef.current} ${transcript}`
                  : transcript

                setState(prev => ({ ...prev, transcript: interimTranscript }))
                onTranscript?.(interimTranscript, false)
              }
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      socket.onclose = () => {
        setState(prev => ({ ...prev, isListening: false, isConnecting: false }))
        cleanup()
      }

      socket.onerror = () => {
        const errorMsg = "Connection to Deepgram failed"
        setState(prev => ({ ...prev, error: errorMsg, isListening: false, isConnecting: false }))
        onError?.(errorMsg)
        cleanup()
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to access microphone"
      setState(prev => ({ ...prev, error: errorMsg, isConnecting: false }))
      onError?.(errorMsg)
      cleanup()
    }
  }, [config?.apiKey, onTranscript, onError, onVolumeChange, cleanup])

  // Stop listening
  const stopListening = useCallback(() => {
    cleanup()
    setState(prev => ({ ...prev, isListening: false, isConnecting: false }))
  }, [cleanup])

  // Reset transcript
  const resetTranscript = useCallback(() => {
    transcriptRef.current = ""
    setState(prev => ({ ...prev, transcript: "" }))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    ...state,
    startListening,
    stopListening,
    resetTranscript,
    isAvailable: !!config?.apiKey,
  }
}
