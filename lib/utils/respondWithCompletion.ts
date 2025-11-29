import { Stream } from 'openai/streaming.mjs'
import { ChatCompletionChunk } from 'openai/resources/chat/completions.mjs'

export async function* respondWithCompletion(
  responseStream: Stream<ChatCompletionChunk>,
  { isAccumulated = false }: { isAccumulated?: boolean } = {},
) {
  let currentLine = ''
  let accumulatedContent = ''

  try {
    for await (const chunk of responseStream) {
      const content = chunk.choices[0]?.delta?.content

      if (content) {
        currentLine += content
        accumulatedContent += content
        if (content.includes('\n')) {
          console.log(currentLine)
          currentLine = ''
        }
        yield isAccumulated ? accumulatedContent : content
      }

      if (chunk.choices[0]?.finish_reason === 'stop') {
        if (currentLine) {
          console.log('Final line:', currentLine)
        }
        break
      }
    }

    yield isAccumulated ? accumulatedContent : '[DONE]'
  } catch (err: any) {
    console.error('Error in respondWithCompletion', err)
    throw new Error(err)
  }
}
