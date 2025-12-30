import { Statement, StatementType } from "./statements";

/**
 * Program entity
 */
export class Program {
  type: StatementType.Program = StatementType.Program;
  body: Statement[];

  constructor(body: Statement[]) {
    this.body = body;
  }
}
