import { AstVisitor } from "../AstVisitor";
import { AstNode } from "./AstNode";
import { Range } from "./Range";
import { StatementNode } from "./StatementNode";
import { AxisParameterNode } from "./AxisParameterNode";

export class MotionCommandNode extends StatementNode {
  constructor(
    range: Range,
    readonly command: string,
    private parameters: AxisParameterNode[] = [],
    parent?: AstNode
  ) {
    super(range, parent);
    this.parameters = parameters;
  }

  getParameters(): AxisParameterNode[] {
    return this.parameters;
  }

  setParameters(parameters: AxisParameterNode[]) {
    this.parameters.push(...parameters);
  }

  accept<T>(visitor: AstVisitor<T>): T {
    return visitor.visitMotionCommand(this);
  }
}
