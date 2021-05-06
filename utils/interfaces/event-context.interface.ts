import Moleculer from "moleculer";
import { NodeItem } from "./node-item.interface";

export interface EventContext extends Moleculer.Context {
	meta: {
		filename: string;
		fileDocId: string;
		fileChunkId: string;
	};
	params: {
		filename: string;
		id: string;
		node: NodeItem;
		on: (event: "error", callback: (v: any) => void) => void;
		pipe: (v: any) => void;
	};
}
