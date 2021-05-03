import Moleculer, { ActionEndpoint, Strategies } from "moleculer";

const BaseStrategy = Strategies.Base;

export class MasterStrategy extends BaseStrategy {
	public select(
		list: ActionEndpoint[],
		ctx?: Moleculer.Context
	): Moleculer.Endpoint {
		const meta: { masterNodeId?: string } = ctx.meta;
		return list.find(node => node.id === meta.masterNodeId);
	}
}
