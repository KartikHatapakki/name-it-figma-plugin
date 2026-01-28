import { ParsedName } from '../types/batch'
import { COMMON_WORDS } from './wordDictionary'

// Main parsing function - tries multiple strategies
export function parseLayerName(name: string): ParsedName {
  // Strategy 1: Explicit separator detection
  const separatorResult = trySeparatorParsing(name)
  if (separatorResult && separatorResult.parts.length > 1) return separatorResult

  // Strategy 2: CamelCase/PascalCase detection
  const camelResult = tryCamelCaseParsing(name)
  if (camelResult && camelResult.parts.length > 1) return camelResult

  // Strategy 3: Number boundary detection
  const numberResult = tryNumberBoundaryParsing(name)
  if (numberResult && numberResult.parts.length > 1) return numberResult

  // Strategy 4: Dictionary-based word detection
  const dictResult = tryDictionaryParsing(name)
  if (dictResult && dictResult.parts.length > 1) return dictResult

  // Fallback: single part
  return { parts: [name] }
}

// Separator detection (_, -, /, ., space)
function trySeparatorParsing(name: string): ParsedName | null {
  // Check if name contains separators
  if (!/[_\-\/\.\s]/.test(name)) return null

  // Split by separators but keep them as separate parts
  const parts: string[] = []
  let current = ''

  for (const char of name) {
    if ('_-/. '.includes(char)) {
      if (current) {
        parts.push(current)
        current = ''
      }
      parts.push(char)
    } else {
      current += char
    }
  }

  if (current) {
    parts.push(current)
  }

  return parts.length > 1 ? { parts } : null
}

// CamelCase: iconBgHover -> [icon, Bg, Hover]
function tryCamelCaseParsing(name: string): ParsedName | null {
  // Check for camelCase pattern (lowercase followed by uppercase)
  if (!/[a-z][A-Z]/.test(name)) return null

  const parts = name.split(/(?=[A-Z])/)

  return parts.length > 1 ? { parts } : null
}

// Number boundaries: button01 -> [button, 01]
function tryNumberBoundaryParsing(name: string): ParsedName | null {
  // Check for letter-number or number-letter boundaries
  if (!/(\d[a-zA-Z]|[a-zA-Z]\d)/.test(name)) return null

  const parts = name.split(/(?<=\D)(?=\d)|(?<=\d)(?=\D)/)

  return parts.length > 1 ? { parts } : null
}

// Dictionary-based greedy matching
function tryDictionaryParsing(name: string): ParsedName | null {
  const lowerName = name.toLowerCase()
  const parts: string[] = []
  let remaining = name
  let lowerRemaining = lowerName

  while (lowerRemaining.length > 0) {
    let matched = false

    // Try to match longest word first (max 12 chars)
    for (let len = Math.min(lowerRemaining.length, 12); len >= 2; len--) {
      const candidate = lowerRemaining.slice(0, len)
      if (COMMON_WORDS.has(candidate)) {
        parts.push(remaining.slice(0, len))
        remaining = remaining.slice(len)
        lowerRemaining = lowerRemaining.slice(len)
        matched = true
        break
      }
    }

    if (!matched) {
      // No dictionary match - consume one character and add to previous part or start new
      if (parts.length > 0 && parts[parts.length - 1].length < 3) {
        // Append to previous short part
        parts[parts.length - 1] += remaining[0]
      } else {
        parts.push(remaining[0])
      }
      remaining = remaining.slice(1)
      lowerRemaining = lowerRemaining.slice(1)
    }
  }

  // Merge single-character parts with neighbors
  const mergedParts = mergeSingleChars(parts)

  return mergedParts.length > 1 ? { parts: mergedParts } : null
}

// Merge single character parts with their neighbors
function mergeSingleChars(parts: string[]): string[] {
  const result: string[] = []

  for (const part of parts) {
    if (part.length === 1 && result.length > 0) {
      // Merge with previous
      result[result.length - 1] += part
    } else if (part.length === 1 && result.length === 0) {
      result.push(part)
    } else {
      // If previous part is single char, merge it with current
      if (result.length > 0 && result[result.length - 1].length === 1) {
        result[result.length - 1] += part
      } else {
        result.push(part)
      }
    }
  }

  return result
}

// Get maximum columns needed for a set of parsed names
export function getMaxColumns(parsedNames: ParsedName[]): number {
  return Math.max(1, ...parsedNames.map(p => p.parts.length))
}

// Pad parsed name parts to match column count
export function padParts(parts: string[], columnCount: number): string[] {
  const result = [...parts]
  while (result.length < columnCount) {
    result.push('')
  }
  return result
}
