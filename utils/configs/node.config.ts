import Moleculer, { Cacher } from "moleculer";
import { CACHE_KEYS } from "../../constants";
import { getNodeCacheKey } from "../common";

export class NodeConfig {
	private readonly nodeId: string = "";
	private readonly cacheService: Cacher = null;
	private readonly nodeCurrentMasterCacheKey: string = "";
	private readonly nodeAmIMasterCacheKey: string = "";

	public constructor(nodeId: string, cacheService: Cacher) {
		this.nodeId = nodeId;
		this.cacheService = cacheService;
		this.nodeCurrentMasterCacheKey = getNodeCacheKey(
			this.nodeId,
			CACHE_KEYS.NODE_CURRENT_MASTER
		);
		this.nodeAmIMasterCacheKey = getNodeCacheKey(
			this.nodeId,
			CACHE_KEYS.NODE_AM_I_MASTER
		);
	}

	public async set(key: string, value: any) {
		switch (key) {
			case CACHE_KEYS.NODE_CURRENT_MASTER: {
				await this.cacheService.set(
					this.nodeCurrentMasterCacheKey,
					value
				);
				break;
			}

			case CACHE_KEYS.NODE_AM_I_MASTER: {
				await this.cacheService.set(this.nodeAmIMasterCacheKey, value);
				break;
			}

			default: {
				throw new Error("Undefined Node Configuration entry.");
			}
		}
	}

	public async get(
		key: string
	): Promise<Moleculer.GenericObject | string | null | Error> {
		let res: {};

		switch (key) {
			case CACHE_KEYS.NODE_CURRENT_MASTER: {
				res = await this.cacheService.get(
					this.nodeCurrentMasterCacheKey
				);
				break;
			}

			case CACHE_KEYS.NODE_AM_I_MASTER: {
				res = await this.cacheService.get(this.nodeAmIMasterCacheKey);
				break;
			}

			default: {
				res = new Promise((_, reject) =>
					reject(Error("Undefined Node Configuration entry."))
				);
			}
		}

		return res;
	}
}
