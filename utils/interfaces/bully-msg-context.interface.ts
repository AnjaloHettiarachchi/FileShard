import Moleculer, { Context } from "moleculer";
import { BullyMsg } from "./bully-msg.interface";

export interface BullyMsgContext extends Context {
	params: BullyMsg | Moleculer.GenericObject;
}
