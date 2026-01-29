import { SeriesInfo } from '../types/batch'

// Detect series from selected values
export function detectSeries(values: string[]): SeriesInfo {
  if (values.length === 0) {
    return { type: 'constant', values: [], step: 0 }
  }

  if (values.length === 1) {
    // Single value - will repeat
    return { type: 'constant', values, step: 0 }
  }

  // Try mixed text+number pattern: "Item 1", "Item 2" or "icon-01", "icon-02"
  const mixedResult = tryMixedSeries(values)
  if (mixedResult) return mixedResult

  // Try pure numeric detection: 1, 2, 3 or 01, 02, 03
  const numericResult = tryNumericSeries(values)
  if (numericResult) return numericResult

  // Try alphabetic: A, B, C or a, b, c
  const alphaResult = tryAlphabeticSeries(values)
  if (alphaResult) return alphaResult

  // Fallback: repeat pattern
  return { type: 'constant', values, step: 0 }
}

// Try to detect mixed text+number patterns like "Item 1", "Item 2" or "img_01", "img_02"
function tryMixedSeries(values: string[]): SeriesInfo | null {
  // Find numbers in each value
  const parsed = values.map(v => {
    // Match all numbers in the string
    const matches = [...v.matchAll(/(\d+)/g)]
    if (matches.length === 0) return null

    // Use the last number found (most common pattern: "icon-01", "item_v2")
    const lastMatch = matches[matches.length - 1]
    const num = parseInt(lastMatch[1], 10)
    const padLength = lastMatch[1].length
    const index = lastMatch.index!
    const prefix = v.substring(0, index)
    const suffix = v.substring(index + lastMatch[1].length)

    return { num, padLength, prefix, suffix, original: v }
  })

  // Check if all values have numbers and same prefix/suffix structure
  if (parsed.some(p => p === null)) return null

  const validParsed = parsed as Array<{ num: number; padLength: number; prefix: string; suffix: string; original: string }>

  // Check if all have same prefix and suffix
  const firstPrefix = validParsed[0].prefix
  const firstSuffix = validParsed[0].suffix
  const samePrefixSuffix = validParsed.every(p => p.prefix === firstPrefix && p.suffix === firstSuffix)

  if (!samePrefixSuffix) return null

  // Calculate steps between numbers
  const steps: number[] = []
  for (let i = 1; i < validParsed.length; i++) {
    steps.push(validParsed[i].num - validParsed[i - 1].num)
  }

  // Check if all steps are equal
  if (steps.length > 0 && steps.every(s => s === steps[0])) {
    return {
      type: 'mixed',
      values,
      step: steps[0],
      prefix: firstPrefix,
      suffix: firstSuffix,
      padLength: validParsed[0].padLength,
    }
  }

  return null
}

function tryNumericSeries(values: string[]): SeriesInfo | null {
  const nums = values.map(v => {
    const match = v.match(/^(\d+)$/)
    return match ? { num: parseInt(match[1], 10), padded: v } : null
  })

  if (nums.some(n => n === null)) return null

  const validNums = nums as Array<{ num: number; padded: string }>

  // Calculate steps
  const steps: number[] = []
  for (let i = 1; i < validNums.length; i++) {
    steps.push(validNums[i].num - validNums[i - 1].num)
  }

  // Check if all steps are equal
  if (steps.length > 0 && steps.every(s => s === steps[0])) {
    return {
      type: 'numeric',
      values,
      step: steps[0],
    }
  }

  return null
}

function tryAlphabeticSeries(values: string[]): SeriesInfo | null {
  // Check if all single letters
  if (!values.every(v => /^[A-Za-z]$/.test(v))) return null

  const codes = values.map(v => v.charCodeAt(0))

  // Check sequential
  const steps: number[] = []
  for (let i = 1; i < codes.length; i++) {
    steps.push(codes[i] - codes[i - 1])
  }

  if (steps.length > 0 && steps.every(s => s === steps[0])) {
    return {
      type: 'alphabetic',
      values,
      step: steps[0],
    }
  }

  return null
}

// Continue a series
export function continueSeries(
  series: SeriesInfo,
  count: number
): string[] {
  const result: string[] = []

  switch (series.type) {
    case 'constant':
      // Repeat the pattern
      for (let i = 0; i < count; i++) {
        result.push(series.values[i % Math.max(1, series.values.length)])
      }
      break

    case 'numeric': {
      const lastValue = series.values[series.values.length - 1]
      const lastNum = parseInt(lastValue, 10)
      const padLength = lastValue.length

      for (let i = 0; i < count; i++) {
        const nextNum = lastNum + series.step * (i + 1)
        result.push(String(nextNum).padStart(padLength, '0'))
      }
      break
    }

    case 'alphabetic': {
      const lastChar = series.values[series.values.length - 1]
      const isUpperCase = lastChar === lastChar.toUpperCase()
      let lastCode = lastChar.charCodeAt(0)

      for (let i = 0; i < count; i++) {
        lastCode += series.step

        // Wrap around: Z -> A, z -> a
        if (isUpperCase) {
          if (lastCode > 90) lastCode = 65 + (lastCode - 91)
          if (lastCode < 65) lastCode = 90 - (64 - lastCode)
        } else {
          if (lastCode > 122) lastCode = 97 + (lastCode - 123)
          if (lastCode < 97) lastCode = 122 - (96 - lastCode)
        }

        result.push(String.fromCharCode(lastCode))
      }
      break
    }

    case 'mixed': {
      // Extract the last number from the pattern
      const lastValue = series.values[series.values.length - 1]
      const matches = [...lastValue.matchAll(/(\d+)/g)]
      const lastMatch = matches[matches.length - 1]
      const lastNum = parseInt(lastMatch[1], 10)
      const padLength = series.padLength || lastMatch[1].length
      const prefix = series.prefix || ''
      const suffix = series.suffix || ''

      for (let i = 0; i < count; i++) {
        const nextNum = lastNum + series.step * (i + 1)
        const paddedNum = String(Math.max(0, nextNum)).padStart(padLength, '0')
        result.push(`${prefix}${paddedNum}${suffix}`)
      }
      break
    }
  }

  return result
}
