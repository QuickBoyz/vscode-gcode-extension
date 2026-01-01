import { Range } from "vscode-languageserver";
import { Expression } from "../expressions";
import { StatementType } from "../statements/types";
import { LabeledStatement } from "../statements/LabeledStatement";
import { LabelStatement } from "../statements/LabelStatement";

export abstract class ConditionalStatement extends LabeledStatement {
  constructor(
    range: Range,
    type: StatementType,
    protected condition: Expression,
    label: LabelStatement | null = null
  ) {
    super(range, type, label);
  }
  getCondition(): Expression {
    return this.condition;
  }
}
