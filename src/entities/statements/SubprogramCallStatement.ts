import { Range } from "vscode-languageserver";
import { SPECIAL_MCODES } from "../../constants";
import { MCommandStatement } from "./MCommandStatement";
import { ParamsBlock } from "../ParamsBlock";
/**
 * Subprogram call statement (M98)
 */
export class SubprogramCallStatement extends MCommandStatement {
  constructor(range: Range, params: ParamsBlock | null = null) {
    super(range, SPECIAL_MCODES.SUBPROGRAM_CALL, params);
  }
}
