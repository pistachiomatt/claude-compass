import { variableRegex } from '@/app/types'

export function substitutePromptVariables(
  content: string,
  variables: Array<{ name: string; content?: string }>,
): string {
  const variableMap = Object.fromEntries(
    variables.filter(v => v.name).map(v => [v.name, v.content || '']),
  )

  return content.replace(variableRegex, match => {
    const varName = match.slice(2, -2)
    return variableMap[varName] !== undefined ? variableMap[varName] : match
  })
}
