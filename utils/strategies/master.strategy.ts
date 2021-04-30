import Moleculer, { ActionEndpoint, Strategies } from "moleculer";

const BaseStrategy = Strategies.Base;

export class MasterStrategy extends BaseStrategy {
	public select(
		list: ActionEndpoint[],
		ctx?: Moleculer.Context
	): Moleculer.Endpoint {
		return list.find(nodeEndpoint => {
			ctx.broker.logger.info(
				`Master NodeID: ${nodeEndpoint.service.metadata.masterNodeId}`
			);
			return (
				nodeEndpoint.id === nodeEndpoint.service.metadata.masterNodeId
			);
		});
	}
}
