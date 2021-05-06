"use strict";

import { Context, Service, ServiceSchema } from "moleculer";
import DbService from "moleculer-db";

export default class Connection
	implements Partial<ServiceSchema>, ThisType<Service> {
	private readonly cacheCleanEventName: string;
	private readonly schema: Partial<ServiceSchema> & ThisType<Service>;
	private collection: string;

	public constructor(collectionName: string) {
		this.collection = collectionName;

		this.cacheCleanEventName = `cache.clean.${this.collection}`;

		this.schema = {
			mixins: [DbService],
			events: {
				/**
				 * Subscribe to the cache clean event. If it's triggered
				 * clean the cache entries for this service.
				 *
				 */
				async [this.cacheCleanEventName]() {
					if (this.broker.cacher) {
						await this.broker.cacher.clean(`${this.fullName}.*`);
					}
				},
			},
			methods: {
				/**
				 * Send a cache clearing event when an entity changed.
				 *
				 * @param {String} type
				 * @param {any} json
				 * @param {Context} ctx
				 */
				entityChanged: async (
					type: string,
					json: any,
					ctx: Context
				) => {
					await ctx.broadcast(this.cacheCleanEventName);
				},
			},
			started: async () => {
				//
			},
		};
	}

	public connect() {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const MongoDBAdapter = require("moleculer-db-adapter-mongo");
		this.schema.adapter = new MongoDBAdapter(process.env.MONGO_URI, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});
		this.schema.collection = this.collection;
		return this.schema;
	}

	public get _collection(): string {
		return this.collection;
	}

	public set _collection(value: string) {
		this.collection = value;
	}
}
