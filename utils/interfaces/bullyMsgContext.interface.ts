import Moleculer, { Context } from "moleculer";
import { BullyMsg } from "./bullyMsg.interface";

export interface BullyMsgContext extends Context {
	params: BullyMsg | Moleculer.GenericObject;
}
