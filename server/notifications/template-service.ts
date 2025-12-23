import Handlebars from "handlebars";

export interface TemplateVariable {
  name: string;
  description?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface RenderOptions {
  content: string;
  subject?: string;
  variables: Record<string, unknown>;
}

export interface RenderResult {
  content: string;
  subject?: string;
}

export class TemplateService {
  private compiledCache: Map<string, HandlebarsTemplateDelegate> = new Map();

  compile(template: string): HandlebarsTemplateDelegate {
    const cached = this.compiledCache.get(template);
    if (cached) return cached;

    const compiled = Handlebars.compile(template, { strict: false });
    this.compiledCache.set(template, compiled);
    return compiled;
  }

  render(options: RenderOptions): RenderResult {
    const contentTemplate = this.compile(options.content);
    const renderedContent = contentTemplate(options.variables);

    let renderedSubject: string | undefined;
    if (options.subject) {
      const subjectTemplate = this.compile(options.subject);
      renderedSubject = subjectTemplate(options.variables);
    }

    return {
      content: renderedContent,
      subject: renderedSubject,
    };
  }

  extractVariables(template: string): string[] {
    const regex = /\{\{([^{}]+)\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = regex.exec(template)) !== null) {
      const varName = match[1].trim();
      if (!varName.startsWith("#") && !varName.startsWith("/") && !varName.startsWith("else")) {
        const cleanName = varName.split(" ")[0];
        variables.add(cleanName);
      }
    }

    return Array.from(variables);
  }

  validateVariables(
    template: string,
    variables: Record<string, unknown>,
    requiredVars: TemplateVariable[]
  ): { valid: boolean; missing: string[] } {
    const missing: string[] = [];

    for (const varDef of requiredVars) {
      if (varDef.required && !(varDef.name in variables)) {
        if (!varDef.defaultValue) {
          missing.push(varDef.name);
        }
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  applyDefaults(
    variables: Record<string, unknown>,
    variableDefs: TemplateVariable[]
  ): Record<string, unknown> {
    const result = { ...variables };

    for (const varDef of variableDefs) {
      if (!(varDef.name in result) && varDef.defaultValue !== undefined) {
        result[varDef.name] = varDef.defaultValue;
      }
    }

    return result;
  }

  clearCache(): void {
    this.compiledCache.clear();
  }
}

export const templateService = new TemplateService();
