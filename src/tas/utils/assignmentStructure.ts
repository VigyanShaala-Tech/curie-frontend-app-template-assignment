import type { FormField } from '../types';

export type SectionDisplayStyle = NonNullable<FormField['displayStyle']>;

export interface AssignmentSection {
  key: string;
  title: string;
  displayStyle: SectionDisplayStyle;
  fields: FormField[];
}

export interface AssignmentStep {
  key: string;
  title: string;
  sectionTitle: string;
  displayStyle: SectionDisplayStyle;
  fields: FormField[];
  ordinal?: number;
  instruction?: string;
}

const normalizeTitle = (value: string) => value.trim().replace(/\s+/g, ' ');

const stepInstruction = (fields: FormField[]) => fields
  .map((field) => field.sectionInstruction?.trim())
  .find(Boolean);

/**
 * Missing metadata is intentionally safe: each legacy field becomes its own
 * Cards section and uses its label as the title.
 */
export function buildAssignmentSections(fields: FormField[]): AssignmentSection[] {
  const sections: AssignmentSection[] = [];
  const named = new Map<string, AssignmentSection>();

  fields.forEach((field) => {
    const sectionTitle = normalizeTitle(field.section ?? '');
    if (!sectionTitle) {
      sections.push({
        key: `field:${field.id}`,
        title: field.label || 'Untitled section',
        displayStyle: field.displayStyle ?? 'cards',
        fields: [field],
      });
      return;
    }

    const key = sectionTitle.toLocaleLowerCase();
    const existing = named.get(key);
    if (existing) {
      existing.fields.push(field);
      return;
    }

    const section: AssignmentSection = {
      key: `section:${key}`,
      title: sectionTitle,
      displayStyle: field.displayStyle ?? 'cards',
      fields: [field],
    };
    named.set(key, section);
    sections.push(section);
  });

  return sections;
}

/**
 * Turn reusable section metadata into learner-sized steps. Cards stay grouped
 * by section, while each Table row and Stage becomes its own step. This keeps
 * large assignments navigable without changing field IDs or stored answers.
 */
export function buildAssignmentSteps(fields: FormField[]): AssignmentStep[] {
  return buildAssignmentSections(fields).flatMap((section): AssignmentStep[] => {
    if (section.displayStyle === 'table') {
      const rows = Array.from(new Set(
        section.fields.map((field) => field.tableRow?.trim() || field.label),
      ));
      return rows.map((row) => {
        const rowFields = section.fields.filter(
          (field) => (field.tableRow?.trim() || field.label) === row,
        );
        return {
          key: `${section.key}:row:${row.toLocaleLowerCase()}`,
          title: row,
          sectionTitle: section.title,
          displayStyle: section.displayStyle,
          fields: rowFields,
          instruction: stepInstruction(rowFields),
        };
      });
    }

    if (section.displayStyle === 'stages') {
      const stageNames = Array.from(new Set(
        section.fields.map((field) => field.stage?.trim() || field.label),
      ));
      return stageNames
        .map((name) => {
          const stageFields = section.fields.filter(
            (field) => (field.stage?.trim() || field.label) === name,
          );
          return {
            key: `${section.key}:stage:${name.toLocaleLowerCase()}`,
            title: name,
            sectionTitle: section.title,
            displayStyle: section.displayStyle,
            fields: stageFields,
            instruction: stepInstruction(stageFields),
            ordinal: Math.min(
              ...stageFields.map((field) => field.stageOrder ?? Number.MAX_SAFE_INTEGER),
            ),
          };
        })
        .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
    }

    return [{
      key: section.key,
      title: section.title,
      sectionTitle: section.title,
      displayStyle: section.displayStyle,
      fields: section.fields,
      instruction: stepInstruction(section.fields),
    }];
  });
}

export function validateStructuralMetadata(fields: FormField[]): string[] {
  const errors: string[] = [];
  buildAssignmentSections(fields).forEach((section) => {
    section.fields.forEach((field) => {
      if (section.displayStyle === 'table' && (!field.tableRow?.trim() || !field.tableColumn?.trim())) {
        errors.push(`${field.label || field.id}: Table fields need a row and column.`);
      }
      if (section.displayStyle === 'stages' && (!field.stage?.trim() || field.stageOrder == null)) {
        errors.push(`${field.label || field.id}: Stage fields need a stage name and order.`);
      }
    });
  });
  return errors;
}
