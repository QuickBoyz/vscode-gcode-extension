import { BaseNode } from "./BaseNode";
import { VariableExpression, VariableReference } from "./expressions";
import { Statement, StatementType } from "./statements";
import { Range } from "vscode-languageserver";

/**
 * Program entity
 */
export class Program extends BaseNode<StatementType.Program> {
  private variables: VariableExpression[] = [];
  private variableReferences: VariableReference[] = [];

  constructor(
    range: Range = Range.create(0, 0, 0, 0),
    private body: Statement[] = [],
    private hasStartDelimiter: boolean = false,
    private hasEndDelimiter: boolean = false
  ) {
    super(range, StatementType.Program);
  }

  getHasStartDelimiter(): boolean {
    return this.hasStartDelimiter;
  }

  getHasEndDelimiter(): boolean {
    return this.hasEndDelimiter;
  }

  setHasStartDelimiter(hasStartDelimiter: boolean) {
    this.hasStartDelimiter = hasStartDelimiter;
  }

  setHasEndDelimiter(hasEndDelimiter: boolean) {
    this.hasEndDelimiter = hasEndDelimiter;
  }

  getBody(): Statement[] {
    return this.body;
  }

  setBody(body: Statement[]) {
    this.body = body;
  }

  getVariables(): VariableExpression[] {
    return this.variables;
  }

  getVariableReferences(): VariableReference[] {
    return this.variableReferences;
  }

  addVariable(variable: VariableExpression) {
    this.variables.push(variable);
  }

  addVariableReference(variableReference: VariableReference) {
    this.variableReferences.push(variableReference);
  }

  getVariable(id: number | string): VariableExpression | null {
    return this.variables.find((v) => v.getId() === id) ?? null;
  }

  getVariableReferenceForVariable(
    id: number | string
  ): VariableReference[] {
    return this.variableReferences.filter((v) => v.getId() === id);
  }

  removeVariable(id: number | string) {
    this.variables = this.variables.filter((v) => v.getId() !== id);
  }

  removeVariableReferences(id: number | string) {
    this.variableReferences = this.variableReferences.filter(
      (v) => v.getId() !== id
    );
  }

  toString(): string {
    return this.body
      .map((statement) => statement.toString())
      .join("\n");
  }
}
