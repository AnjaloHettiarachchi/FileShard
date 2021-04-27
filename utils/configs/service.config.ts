import Moleculer, { Cacher } from "moleculer";
import { CACHE_KEYS } from "../../constants";
import { getServiceCacheKey } from "../common";

export class ServiceConfig {
	private readonly serviceName: string = "";
	private readonly cacheService: Cacher = null;
	private readonly serviceCurrentMasterCacheKey: string = "";

	public constructor(serviceName: string, cacheService: Cacher) {
		this.serviceName = serviceName;
		this.cacheService = cacheService;
		this.serviceCurrentMasterCacheKey = getServiceCacheKey(
			this.serviceName,
			CACHE_KEYS.SERVICE_CURRENT_MASTER
		);
	}

	public async set(key: string, value: any) {
		switch (key) {
			case CACHE_KEYS.SERVICE_CURRENT_MASTER: {
				await this.cacheService.set(
					this.serviceCurrentMasterCacheKey,
					value
				);
				break;
			}
			default: {
				throw new Error("Undefined Service Configuration entry.");
			}
		}
	}

	public async get(
		key: string
	): Promise<Moleculer.GenericObject | string | null | Error> {
		let res: {};

		switch (key) {
			case CACHE_KEYS.SERVICE_CURRENT_MASTER: {
				res = await this.cacheService.get(
					this.serviceCurrentMasterCacheKey
				);
				break;
			}
			default: {
				res = new Promise((_, reject) =>
					reject(Error("Undefined Service Configuration entry."))
				);
			}
		}

		return res;
	}
}
