import Moleculer from "moleculer";
import { NodeItem } from "./node-item.interface";

export interface EventContext extends Moleculer.Context {
	meta: {
		filename: string;
	};
	params: {
		node: NodeItem;
		on: (event: "error", callback: (v: any) => void) => void;
		pipe: (v: any) => void;
	};
}
