import { STATUS_CONFIG, STATUS_VALUES } from '../src/models/application.js';

export { STATUS_VALUES };

export const STATUS_COLORS = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([status, config]) => [status, config.borderAccent]),
);

export const STATUS_LABELS = {
  phone_screen: 'Screening',
  wishlisted: 'Wishlist',
  applied: 'Applied',
  interview: 'Interview',
  assessment: 'Assessment',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  ghosted: 'Ghosted',
};
