import { describe, expect, it } from 'vitest';
import { parseJobPost } from '../../src/utils/jobPostParser.js';

describe('parseJobPost', () => {
  describe('short input guard', () => {
    it('returns empty fields for empty string', () => {
      const result = parseJobPost('');
      expect(result.companyName).toBe('');
      expect(result.jobTitle).toBe('');
      expect(result.responsibilities).toBe('');
      expect(result.location).toBe('');
      expect(result.workSetup).toBe('');
      expect(result.shift).toBe('');
      expect(result.salary).toBeNull();
      expect(result.jobPostingUrl).toBe('');
      expect(result.skills).toEqual([]);
      expect(result.preferredSkills).toEqual([]);
      expect(result.recruiter).toBe('');
    });

    it('returns empty fields for text shorter than 20 characters', () => {
      const result = parseJobPost('short');
      expect(result.companyName).toBe('');
      expect(result.jobTitle).toBe('');
      expect(result.responsibilities).toBe('');
      expect(result.location).toBe('');
      expect(result.workSetup).toBe('');
      expect(result.shift).toBe('');
      expect(result.salary).toBeNull();
      expect(result.jobPostingUrl).toBe('');
      expect(result.skills).toEqual([]);
      expect(result.preferredSkills).toEqual([]);
      expect(result.recruiter).toBe('');
    });

    it('does not assign compatibility', () => {
      const result = parseJobPost('');
      expect(result).not.toHaveProperty('compat');
    });
  });

  describe('company name', () => {
    it('extracts company from "Company:" label', () => {
      const text = 'Senior Developer\n\nCompany: Acme Corp\n\nLocation: Manila, Philippines';
      expect(parseJobPost(text).companyName).toBe('Acme Corp');
    });

    it('extracts company from "About [Name]" section header', () => {
      const text = 'Senior Developer position available\n\nAbout Acme Corp\n\nWe are a software company.';
      expect(parseJobPost(text).companyName).toBe('Acme Corp');
    });

    it('returns empty string when no company signal found', () => {
      const text = 'We are looking for a senior developer with 5 years of experience in the field.';
      expect(parseJobPost(text).companyName).toBe('');
    });
  });

  describe('job title', () => {
    it('extracts job title from "Position:" label', () => {
      const text = 'Company: Acme Corp\nPosition: Senior Frontend Engineer\nLocation: Manila\n\nWe are looking for a skilled developer.';
      expect(parseJobPost(text).jobTitle).toBe('Senior Frontend Engineer');
    });

    it('extracts job title as first qualifying line when no label present', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nLocation: Manila\n\nWe are looking for an experienced developer.';
      expect(parseJobPost(text).jobTitle).toBe('Senior Frontend Engineer');
    });

    it('returns empty string when all lines are all-caps or non-qualifying', () => {
      const text = 'WE ARE LOOKING FOR SOMEONE TO JOIN OUR TEAM TODAY FOR AN AMAZING OPPORTUNITY.';
      expect(parseJobPost(text).jobTitle).toBe('');
    });

    it('does not treat a prose sentence as a heading', () => {
      const text = 'Lorem ipsum dolor sit amet consectetur adipiscing elit.';
      expect(parseJobPost(text).jobTitle).toBe('');
    });

    it('keeps the top heading as title when an About the Role section exists', () => {
      const text = `Senior Frontend Engineer
Acme Corp

Location: Manila, Philippines
Work Setup: Remote
Salary: PHP 100,000 - PHP 120,000 per month

About the Role:
We're looking for a Senior Frontend Engineer to join our growing team. You will
be responsible for building and maintaining our customer-facing web applications.

Responsibilities:
- Architect and implement scalable React components
- Collaborate with designers on UI/UX improvements

Required Skills:
React, TypeScript`;
      const result = parseJobPost(text);

      expect(result.jobTitle).toBe('Senior Frontend Engineer');
      expect(result.companyName).toBe('Acme Corp');
      expect(result.responsibilities).toContain('Architect and implement scalable React components');
    });
  });

  describe('responsibilities', () => {
    it('extracts body of a "Responsibilities:" section', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\n\nResponsibilities:\n- Build and maintain UI components\n- Collaborate with designers\n\nRequirements:\n- 3 years experience';
      const result = parseJobPost(text);
      expect(result.responsibilities).not.toBe('');
      expect(result.responsibilities).toContain('Build');
    });

    it('returns empty string when no responsibilities section or long paragraph found', () => {
      const text = 'Company: Acme Corp\nLocation: Manila\nContact: Jane Reyes for more info';
      expect(parseJobPost(text).responsibilities).toBe('');
    });
  });

  describe('location', () => {
    it('extracts location from "Location:" label', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nLocation: Manila\nSalary: ₱150,000 per year';
      expect(parseJobPost(text).location).toBe('Manila');
    });

    it('returns empty string when no location label found', () => {
      const text = 'Company: Acme Corp\n\nWe are a software company with offices around the world.';
      expect(parseJobPost(text).location).toBe('');
    });
  });

  describe('work setup', () => {
    it('extracts "Remote" from "remote" keyword', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nThis is a fully remote position for qualified candidates.';
      expect(parseJobPost(text).workSetup).toBe('Remote');
    });

    it('extracts "Hybrid" from "hybrid" keyword', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nThis is a hybrid role with 3 days in office per week.';
      expect(parseJobPost(text).workSetup).toBe('Hybrid');
    });

    it('extracts "On-site" from "on-site" keyword', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nThis is an on-site position at our Manila office.';
      expect(parseJobPost(text).workSetup).toBe('On-site');
    });

    it('extracts "On-site" from "onsite" keyword', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nThis is an onsite position at our Manila office.';
      expect(parseJobPost(text).workSetup).toBe('On-site');
    });

    it('returns empty string when no work setup keyword found', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nLocation: Manila, Philippines\n\nWe need a skilled developer.';
      expect(parseJobPost(text).workSetup).toBe('');
    });
  });

  describe('shift', () => {
    it('extracts "Night" from "night shift" keyword', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nThis position requires night shift work from 10pm to 6am.';
      expect(parseJobPost(text).shift).toBe('Night');
    });

    it('returns empty string when no shift keyword found', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nLocation: Manila, Philippines\nWe are fully remote here.';
      expect(parseJobPost(text).shift).toBe('');
    });
  });

  describe('salary', () => {
    it('extracts lower bound of monthly range and annualizes (₱100k × 12 = ₱1,200,000)', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nLocation: Manila\nSalary: ₱100,000 – ₱120,000 per month\n\nWe are looking for an experienced developer.';
      expect(parseJobPost(text).salary).toBe(1200000);
    });

    it('extracts annual salary as-is', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nLocation: Manila\nSalary: ₱150,000 per year\n\nJoin our team today.';
      expect(parseJobPost(text).salary).toBe(150000);
    });

    it('returns null for unparseable salary', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nLocation: Manila\nSalary: Competitive and negotiable\n\nJoin our team today.';
      expect(parseJobPost(text).salary).toBeNull();
    });
  });

  describe('URL', () => {
    it('extracts a valid https URL from the text', () => {
      const text = 'Apply at https://example.com/jobs/123 for this position.\nCompany: Acme Corp\nLocation: Manila\nWe need a skilled developer.';
      expect(parseJobPost(text).jobPostingUrl).toBe('https://example.com/jobs/123');
    });

    it('returns empty string when no valid URL is present', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nLocation: Manila\nApply at htp:/badurl here.\nWe need a skilled developer.';
      expect(parseJobPost(text).jobPostingUrl).toBe('');
    });
  });

  describe('skills', () => {
    it('extracts comma-separated skills from a Skills section', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nLocation: Manila\n\nSkills:\nReact, TypeScript, CSS\n\nAbout us: We are a great team.';
      const result = parseJobPost(text);
      expect(result.skills).toContain('React');
      expect(result.skills).toContain('TypeScript');
    });

    it('adds preferred skills to both preferredSkills and skills arrays', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nLocation: Manila\n\nSkills:\nReact, TypeScript\n\nPreferred Skills:\nGraphQL, Testing\n\nAbout us: We are a great team.';
      const result = parseJobPost(text);
      expect(result.preferredSkills).toContain('GraphQL');
      expect(result.skills).toContain('GraphQL');
      expect(result.skills).toContain('React');
    });
  });

  describe('real posting parser quality', () => {
    it('extracts a title from a role-specific responsibilities heading', () => {
      const text = `About the job
The Associate Project Manager is responsible for planning, executing, and closing moderately complex projects.

Associate Project Manager Responsibilities

Planning and coordination: Maintains and validates project scope, objectives, timelines, and deliverables.
Lead and organize meetings: Prepare agendas, facilitate discussions, document notes, and track action items to completion.

Skills/tools/abilities

English proficiency
Proficiency in project management software and tools, such as Smartsheet
Six Sigma and Lean Sigma preferred`;

      const result = parseJobPost(text);

      expect(result.jobTitle).toBe('Associate Project Manager');
      expect(result.responsibilities).toContain('Planning and coordination');
      expect(result.skills).toContain('Smartsheet');
      expect(result.skills).toContain('Six Sigma');
    });

    it('filters qualification prose down to skill-like items', () => {
      const text = `Position: Scrum Master
Work Set-Up: Hybrid-2x per week onsite.
Location: Ayala, Makati City

JOB DESCRIPTION AND RESONSIBILITIES:
Lead Scrum ceremonies such as sprint planning, daily stand-ups, and retrospectives.
Ensure the team follows Agile processes and removes impediments.

QUALIFICATIONS:
Bachelor's degree in IT, Business, or related field.
Scrum Master certification (CSM, SAFe).
Proven experience as a Scrum Master with Agile teams.
Strong communication, coaching, and facilitation skills.
Familiarity with Jira, Agile DevOps, or other Agile tools.`;

      const result = parseJobPost(text);

      expect(result.skills).toContain('Scrum Master certification (CSM, SAFe)');
      expect(result.skills).toContain('Strong communication');
      expect(result.skills).toContain('Coaching');
      expect(result.skills).toContain('Facilitation');
      expect(result.skills).toContain('Jira');
      expect(result.skills).toContain('Agile DevOps');
      expect(result.skills).not.toContain("Bachelor's degree in IT, Business, or related field");
      expect(result.skills).not.toContain('Proven experience as a Scrum Master with Agile teams');
      expect(result.skills).not.toContain('or other Agile tools');
    });

    it('does not treat responsibility lines as a skills section', () => {
      const text = `Senior Technical Product Owner

What will you do as a Senior Technical Product Owner?

Each product has different needs, but your day can typically involve the following:

Collaborating with product management and stakeholders on the development of product roadmaps
Identifying opportunities to add value to the product
Requirements gathering
Backlog management
Working closely with the developers and user experience (UX) teams to define solutions
Facilitating team ceremonies
Supporting QA and UAT strategy
Supporting incident management

What makes you the ideal candidate for this role?

Essential:

That you apply the Modern Agile values to your work
Great communication skills and the ability to develop strong working relationships`;

      const result = parseJobPost(text);

      expect(result.responsibilities).toContain('Collaborating with product management');
      expect(result.responsibilities).toContain('Supporting incident management');
      expect(result.skills).toEqual([]);
    });
  });

  describe('recruiter', () => {
    it('extracts recruiter from "Contact:" label', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nLocation: Manila\nContact: Jane Reyes\n\nWe are looking for a skilled developer.';
      expect(parseJobPost(text).recruiter).toBe('Jane Reyes');
    });

    it('returns empty string when no recruiter signal found', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nLocation: Manila, Philippines\n\nWe are a software company with opportunities.';
      expect(parseJobPost(text).recruiter).toBe('');
    });
  });

  describe('compat', () => {
    it('leaves compatibility unset for the server to compute', () => {
      const text = 'Senior Frontend Engineer\nCompany: Acme Corp\nLocation: Manila\n\nWe need a skilled developer.';
      const result = parseJobPost(text);

      expect(result).not.toHaveProperty('compat');
    });
  });
});
