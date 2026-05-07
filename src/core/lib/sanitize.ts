//src\core\lib\sanitize.ts
import sanitizeHtml, { IOptions } from 'sanitize-html';

const STRICT_OPTIONS: IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  allowProtocolRelative: false,
};

const RICH_TEXT_OPTIONS: IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'u', 'code', 'pre', 'ul', 'ol', 'li'],
  allowedAttributes: {},
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
};

export function sanitizeInput(input: unknown): string {
  if (!input || typeof input !== 'string') return '';
  
  try {
    return sanitizeHtml(input, STRICT_OPTIONS).trim();
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[sanitizeInput] Error:', error);
    }
    return '';
  }
}

export function sanitizeNickname(input: unknown): string {
  if (!input || typeof input !== 'string') return '';
  
  try {
    let sanitized = input
      .replace(/[^a-zA-Z0-9_\-\sа-яА-ЯёЁ]/gu, '') 
      .replace(/\s+/g, ' ')
      .trim();
    
    sanitized = sanitizeHtml(sanitized, STRICT_OPTIONS);
    
    return sanitized.slice(0, 20);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[sanitizeNickname] Error:', error);
    }
    return '';
  }
}

export function escapeHtml(text: unknown): string {
  if (!text || typeof text !== 'string') return '';
  
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  
  return text.replace(/[&<>"'`=/]/g, (char) => map[char] || char);
}

export function sanitizeRichText(input: unknown): string {
  if (!input || typeof input !== 'string') return '';
  
  try {
    return sanitizeHtml(input, RICH_TEXT_OPTIONS);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[sanitizeRichText] Error:', error);
    }
    return '';
  }
}

export function sanitizeUrl(url: unknown): string {
  if (!url || typeof url !== 'string') return '';
  
  try {
    const trimmed = url.trim();
    
    const parsed = new URL(trimmed);
    const allowedProtocols = ['http:', 'https:', 'mailto:'];
    
    if (!allowedProtocols.includes(parsed.protocol)) {
      return '';
    }
    
    return sanitizeHtml(trimmed, {
      allowedTags: [],
      allowedAttributes: {},
    });
  } catch {
    return '';
  }
}


export function sanitizeForJs(input: unknown): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/\\/g, '\\\\')
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/"/g, '\\u0022')
    .replace(/'/g, '\\u0027')
    .replace(/\//g, '\\u002F')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}