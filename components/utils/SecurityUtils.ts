export class SecurityUtils {
  static sanitizeForLog(input: string): string {
    return input.replace(/[\r\n\t]/g, '_').substring(0, 200);
  }

  static sanitizeHTML(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  static validateInput(input: string, maxLength: number = 1000): string {
    if (typeof input !== 'string') return '';
    return input.substring(0, maxLength).trim();
  }
}