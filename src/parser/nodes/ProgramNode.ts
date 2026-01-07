import { StatementNode } from "./StatementNode";

export class ProgramNode {
  constructor(
    public readonly statements: StatementNode[],
    public readonly hasStartDelimiter: boolean = false,
    public readonly hasEndDelimiter: boolean = false
  ) {}
}
