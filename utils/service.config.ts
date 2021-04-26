import Moleculer, { Cacher } from "moleculer";
import { CACHE_KEYS } from "../constants";

export class ServiceConfig {
	private readonly serviceName: string = "";
	private readonly cacheService: Cacher = null;

	public constructor(serviceName: string, cacheService: Cacher) {
		this.serviceName = serviceName;
		this.cacheService = cacheService;
	}

	public async set(key: string, value: any) {
		const cacheKey = this.getCacheKey(
			this.serviceName,
			CACHE_KEYS.SERVICE_CURRENT_MASTER
		);

		switch (key) {
			case CACHE_KEYS.SERVICE_CURRENT_MASTER: {
				await this.cacheService.set(cacheKey, value);
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
		const cacheKey = this.getCacheKey(
			this.serviceName,
			CACHE_KEYS.SERVICE_CURRENT_MASTER
		);

		switch (key) {
			case CACHE_KEYS.SERVICE_CURRENT_MASTER: {
				res = await this.cacheService.get(cacheKey);
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

	protected getCacheKey(serviceName: string, genericCacheKey: string) {
		return `${serviceName.toUpperCase()}_SERVICE.${genericCacheKey}`;
	}
}
