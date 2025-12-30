import { StatementType } from "../parser/types";
import { Statement } from "./statements";

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
