/**
 * Prompt Injection Protection
 *
 * Detects and blocks common prompt injection patterns before
 * user input is sent to the LLM.
 */

// Patterns that indicate prompt injection attempts
const INJECTION_PATTERNS = [
  // System prompt manipulation
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|prompts?)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|prompts?)/i,
  /forget\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|prompts?)/i,
  /override\s+(your|the|all)\s+(rules?|instructions?|guidelines?)/i,
  /new\s+instructions?\s*:/i,

  // Role manipulation
  /you\s+are\s+now\s+(a|an)\s+/i,
  /act\s+(like|as)\s+(a|an)?\s*/i,
  /pretend\s+(you\s+are|to\s+be)\s+(a|an)?\s*/i,
  /roleplay\s+as/i,
  /assume\s+the\s+role\s+of/i,

  // System prompt extraction
  /reveal\s+(your|the)\s+(system\s+)?prompt/i,
  /show\s+(me\s+)?(your|the)\s+(system\s+)?prompt/i,
  /print\s+(your|the)\s+(system\s+)?instructions?/i,
  /output\s+(your|the)\s+(system\s+)?prompt/i,
  /what\s+(is|are)\s+your\s+(system\s+)?instructions?/i,
  /display\s+(your|the)\s+(initial|original)\s+prompt/i,

  // Secrets extraction
  /expose\s+(env|environment)\s+variables?/i,
  /show\s+(me\s+)?(the\s+)?(api\s+)?keys?/i,
  /reveal\s+(the\s+)?(api\s+)?secrets?/i,
  /print\s+(the\s+)?database\s+(credentials?|password)/i,
  /output\s+(your|the)\s+(openai|supabase)\s+key/i,

  // Jailbreak attempts
  /\bjailbreak\b/i,
  /\bDAN\s+mode\b/i,
  /\bdeveloper\s+mode\b/i,
  /\bunlock\s+mode\b/i,
  /\bbypass\s+(safety|content)\s+(filters?|restrictions?)/i,
  /\bno\s+restrictions?\s+mode\b/i,

  // Code execution attempts
  /execute\s+(this\s+)?code/i,
  /run\s+(this\s+)?script/i,
  /eval\s*\(/i,
  /import\s+os\b/i,
  /subprocess\./i,
  /__import__/i,

  // Data exfiltration patterns
  /send\s+(data|info|information)\s+to/i,
  /upload\s+to\s+(external|remote)/i,
  /fetch\s+from\s+http/i,
]

// Keywords that are suspicious when combined
const SUSPICIOUS_KEYWORDS = [
  'system prompt',
  'initial instructions',
  'original prompt',
  'training data',
  'api key',
  'secret key',
  'service role',
  'admin access',
]

export interface SanitizationResult {
  safe: boolean
  sanitized: string
  detectedPatterns: string[]
}

/**
 * Sanitizes user input before sending to the LLM.
 * Detects and blocks prompt injection patterns.
 *
 * @param input - The user's message
 * @returns SanitizationResult with safety status and any detected patterns
 */
export function sanitizeForLLM(input: string): SanitizationResult {
  const detectedPatterns: string[] = []

  // Normalize input for detection
  const normalizedInput = input
    .replace(/[^\w\s]/g, ' ') // Remove special chars
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim()

  // Check against injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input) || pattern.test(normalizedInput)) {
      // Extract matched text for logging (not exposed to user)
      const match = input.match(pattern) || normalizedInput.match(pattern)
      if (match) {
        detectedPatterns.push(pattern.source)
      }
    }
  }

  // Check for suspicious keyword combinations
  const lowercaseInput = input.toLowerCase()
  const suspiciousCount = SUSPICIOUS_KEYWORDS.filter(
    keyword => lowercaseInput.includes(keyword)
  ).length

  if (suspiciousCount >= 2) {
    detectedPatterns.push('multiple_suspicious_keywords')
  }

  // If any patterns detected, return unsafe
  if (detectedPatterns.length > 0) {
    return {
      safe: false,
      sanitized: '',
      detectedPatterns,
    }
  }

  // Sanitize the input by removing potential delimiter injections
  const sanitized = input
    .replace(/```[\s\S]*?```/g, '[code block removed]') // Remove code blocks that might contain prompts
    .replace(/\[INST\]/gi, '[filtered]')
    .replace(/\[\/INST\]/gi, '[filtered]')
    .replace(/<\|.*?\|>/g, '[filtered]') // Remove special tokens
    .replace(/<<SYS>>[\s\S]*?<<\/SYS>>/gi, '[filtered]')
    .trim()

  return {
    safe: true,
    sanitized,
    detectedPatterns: [],
  }
}

/**
 * Creates a prompt injection error response
 */
export function createPromptInjectionResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Your message contains disallowed content. Please rephrase your question.',
      code: 'PROMPT_INJECTION',
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Quick check if input might be a prompt injection attempt
 * Use this for fast pre-filtering before full sanitization
 */
export function isLikelyInjection(input: string): boolean {
  const result = sanitizeForLLM(input)
  return !result.safe
}
