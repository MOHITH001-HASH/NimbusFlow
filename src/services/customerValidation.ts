export interface CustomerValidationError {
  field: string;
  message: string;
}

export interface CustomerValidationResult {
  valid: boolean;
  errors: CustomerValidationError[];
}

export class CustomerValidator {
  public static validate(data: Record<string, any>, isUpdate: boolean = false): CustomerValidationResult {
    const errors: CustomerValidationError[] = [];

    // Name
    if (!isUpdate || data.name !== undefined) {
      if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
        errors.push({ field: 'name', message: 'Name must be at least 2 characters long.' });
      }
    }

    // Phone
    if (!isUpdate || data.phone !== undefined) {
      const phoneRegex = /^\+?[1-9]\d{6,14}$/;
      const cleanPhone = (data.phone || '').replace(/[\s\-()]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        errors.push({ field: 'phone', message: 'Phone must be a valid E.164 phone number (e.g. +15550100001 or +919876543210).' });
      }
    }

    // Email
    if (!isUpdate || data.email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!data.email || !emailRegex.test(data.email)) {
        errors.push({ field: 'email', message: 'Email must be a valid email address.' });
      }
    }

    // Amount Due
    if (!isUpdate || data.amount_due !== undefined) {
      const amount = Number(data.amount_due);
      if (isNaN(amount) || amount < 0) {
        errors.push({ field: 'amount_due', message: 'Amount due must be a non-negative number.' });
      }
    }

    // Last 4
    if (!isUpdate || data.last4 !== undefined) {
      if (!data.last4 || !/^\d{4}$/.test(data.last4.toString().trim())) {
        errors.push({ field: 'last4', message: 'Last 4 card digits must be exactly 4 numeric digits.' });
      }
    }

    // ZIP Code
    if (!isUpdate || data.zip_code !== undefined) {
      if (!data.zip_code || typeof data.zip_code !== 'string' || data.zip_code.trim().length < 3) {
        errors.push({ field: 'zip_code', message: 'Postal / ZIP code must be at least 3 characters.' });
      }
    }

    // Timezone
    if (!isUpdate || data.timezone !== undefined) {
      if (data.timezone) {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: data.timezone });
        } catch {
          errors.push({ field: 'timezone', message: 'Invalid IANA timezone name (e.g. Asia/Kolkata, America/New_York).' });
        }
      }
    }

    // Language
    if (!isUpdate || data.language !== undefined) {
      if (data.language && data.language !== 'en' && data.language !== 'hi') {
        errors.push({ field: 'language', message: 'Language must be either "en" (English) or "hi" (Hindi).' });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
