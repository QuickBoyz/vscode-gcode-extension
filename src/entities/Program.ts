import { Statement, StatementType } from "./statements";

/**
 * Program entity
 */
export class Program {
  private type: StatementType.Program = StatementType.Program;

  constructor(private body: Statement[]) {}

  getBody(): Statement[] {
    return this.body;
  }

  getType(): StatementType.Program {
    return this.type;
  }
}
