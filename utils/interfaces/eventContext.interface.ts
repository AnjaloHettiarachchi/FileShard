import Moleculer from "moleculer";
import { NodeItem } from "./nodeItem.interface";

export interface EventContext extends Moleculer.Context {
	params: { node: NodeItem };
}
