export interface GCodeCommandInfo {
  command: string;
  name: string;
  description: string;
  group?: string;
  parameters?: string[];
  example?: string;
}
