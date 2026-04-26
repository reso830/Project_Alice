import { z } from 'zod';
import { STATUS_VALUES } from '../../shared/constants.js';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const requiredString = (fieldLabel) => z.string({
  error: `${fieldLabel} is required`,
}).trim().min(1, `${fieldLabel} is required`);

const optionalText = z.string().optional();

const dateField = (fieldLabel) => z.string()
  .regex(datePattern, `${fieldLabel} must use YYYY-MM-DD format`)
  .optional();

const jobPostingUrl = z.string()
  .url('Job posting URL must be a valid URL')
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Job posting URL must be a valid http or https URL')
  .optional();

const compat = z.number()
  .int('Compatibility score must be an integer')
  .transform((value) => Math.max(0, Math.min(100, value)))
  .optional();

const metadata = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
  z.null(),
]).optional();

const status = z.string({
  error: 'Status is required',
}).refine(
  (value) => STATUS_VALUES.includes(value),
  `Status must be one of: ${STATUS_VALUES.join(', ')}`,
);

const writableFields = {
  companyName: requiredString('Company name'),
  jobTitle: requiredString('Job title'),
  status,
  compat,
  fav: z.boolean().optional(),
  sourcePlatform: optionalText,
  applicationDate: dateField('Application date'),
  jobPostingUrl,
  recruiter: optionalText,
  notes: optionalText,
  salary: optionalText,
  responsibilities: optionalText,
  skills: z.array(z.string()).optional(),
  followUpAction: optionalText,
  followUpDate: dateField('Follow-up date'),
  metadata,
};

export const createSchema = z.object(writableFields).strip();

export const updateSchema = z.object({
  ...writableFields,
  companyName: writableFields.companyName.optional(),
  jobTitle: writableFields.jobTitle.optional(),
  status: writableFields.status.optional(),
}).strip();

function fieldMessage(issue) {
  if (issue.code === 'invalid_type' && issue.input === undefined) {
    return 'Required';
  }

  return issue.message;
}

export function toApiError(zodError) {
  return zodError.issues.reduce((fields, issue) => {
    const [field] = issue.path;
    if (typeof field === 'string' && fields[field] === undefined) {
      fields[field] = fieldMessage(issue);
    }
    return fields;
  }, {});
}
