import Moleculer, { ActionEndpoint, Strategies } from "moleculer";
import { ServiceConfig } from "../configs/service.config";
import { CACHE_KEYS } from "../../constants";

const BaseStrategy = Strategies.Base;

export class MasterStrategy extends BaseStrategy {
	public select(
		list: ActionEndpoint[],
		ctx?: Moleculer.Context
	): Moleculer.Endpoint {
		return list.find(async nodeEndpoint => {
			const serviceConfig = new ServiceConfig(
				nodeEndpoint.service.name,
				nodeEndpoint.broker.cacher
			);
			const masterNodeId = await serviceConfig.get(
				CACHE_KEYS.SERVICE_CURRENT_MASTER
			);
			return nodeEndpoint.id === masterNodeId;
		});
	}
}
