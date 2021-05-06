import { IncomingMessage } from "http";
import { Context, Service, ServiceBroker } from "moleculer";
import ApiGateway from "moleculer-web";
import { ServiceConfig } from "../utils/configs/service.config";
import { CACHE_KEYS } from "../constants";

export default class ApiService extends Service {
	public constructor(broker: ServiceBroker) {
		super(broker);
		// @ts-ignore
		this.parseServiceSchema({
			name: "api",
			mixins: [ApiGateway],
			// More info about settings: https://moleculer.services/docs/0.14/moleculer-web.html
			settings: {
				port: process.env.PORT || 3000,

				path: "/api",

				routes: [
					{
						path: "/",
						whitelist: [
							// Access to any actions in all services under "/api" URL
							"file.hello",
							"file.node.info",
							"file.list",
						],
						// Route-level Express middlewares. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Middlewares
						use: [
							async (req: any, res: any, next: () => {}) => {
								const serviceConfig = new ServiceConfig(
									"file",
									this.broker.cacher
								);
								req.$ctx.meta.masterNodeId = await serviceConfig.get(
									CACHE_KEYS.SERVICE_CURRENT_MASTER
								);
								next();
							},
						],
						// Enable/disable parameter merging method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Disable-merging
						mergeParams: true,

						// Enable authentication. Implement the logic into `authenticate` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authentication
						authentication: false,

						// Enable authorization. Implement the logic into `authorize` method. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Authorization
						authorization: false,

						// The auto-alias feature allows you to declare your route alias directly in your services.
						// The gateway will dynamically build the full routes from service schema.
						autoAliases: true,

						aliases: {},

						// Calling options. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Calling-options
						callingOptions: {},

						bodyParsers: {
							json: {
								strict: false,
								limit: "1MB",
							},
							urlencoded: {
								extended: true,
								limit: "1MB",
							},
						},

						// Mapping policy setting. More info: https://moleculer.services/docs/0.14/moleculer-web.html#Mapping-policy
						mappingPolicy: "restrict", // Available values: "all", "restrict"

						// Enable/disable logging
						logging: true,
					},
					{
						path: "/file",

						use: [
							async (req: any, res: any, next: () => {}) => {
								const serviceConfig = new ServiceConfig(
									"file",
									this.broker.cacher
								);
								req.$ctx.meta.masterNodeId = await serviceConfig.get(
									CACHE_KEYS.SERVICE_CURRENT_MASTER
								);
								next();
							},
						],

						bodyParsers: {
							json: false,
							urlencoded: false,
						},

						mappingPolicy: "restrict",
						aliases: {
							"POST /upload": "multipart:file.upload",
							"POST /chunk/store": "multipart:file.chunk.store",
							"POST /duplicate/store":
								"multipart:file.duplicate.store",
						},

						busboyConfig: {
							limits: {
								files: 1,
							},
						},
					},
				],
				// Do not log client side errors (does not log an error response when the error.code is 400<=X<500)
				log4XXResponses: false,
				// Logging the request parameters. Set to any log level to enable it. E.g. "info"
				logRequestParams: null,
				// Logging the response data. Set to any log level to enable it. E.g. "info"
				logResponseData: null,
				// Serve assets from "public" folder
				assets: {
					folder: "public",
					// Options to `server-static` module
					options: {},
				},
			},

			methods: {
				/**
				 * Authenticate the request. It checks the `Authorization` token value in the request header.
				 * Check the token value & resolve the user by the token.
				 * The resolved user will be available in `ctx.meta.user`
				 *
				 * PLEASE NOTE, IT'S JUST AN EXAMPLE IMPLEMENTATION. DO NOT USE IN PRODUCTION!
				 *
				 * @param {Context} ctx
				 * @param {any} route
				 * @param {IncomingMessage} req
				 * @returns {Promise}

				async authenticate (ctx: Context, route: any, req: IncomingMessage): Promise < any >  => {
					// Read the token from header
					const auth = req.headers.authorization;

					if (auth && auth.startsWith("Bearer")) {
						const token = auth.slice(7);

						// Check the token. Tip: call a service which verify the token. E.g. `accounts.resolveToken`
						if (token === "123456") {
							// Returns the resolved user. It will be set to the `ctx.meta.user`
							return {
								id: 1,
								name: "John Doe",
							};

						} else {
							// Invalid token
							throw new ApiGateway.Errors.UnAuthorizedError(ApiGateway.Errors.ERR_INVALID_TOKEN, {
								error: "Invalid Token",
							});
						}

					} else {
						// No token. Throw an error or do nothing if anonymous access is allowed.
						// Throw new E.UnAuthorizedError(E.ERR_NO_TOKEN);
						return null;
					}
				},
				 */
				/**
				 * Authorize the request. Check that the authenticated user has right to access the resource.
				 *
				 * PLEASE NOTE, IT'S JUST AN EXAMPLE IMPLEMENTATION. DO NOT USE IN PRODUCTION!
				 *
				 * @param {Context} ctx
				 * @param {Object} route
				 * @param {IncomingMessage} req
				 * @returns {Promise}

				async authorize (ctx: Context < any, {
					user: string;
				} > , route: Record<string, undefined>, req: IncomingMessage): Promise < any > => {
					// Get the authenticated user.
					const user = ctx.meta.user;

					// It check the `auth` property in action schema.
					// @ts-ignore
					if (req.$action.auth === "required" && !user) {
						throw new ApiGateway.Errors.UnAuthorizedError("NO_RIGHTS", {
							error: "Unauthorized",
						});
					}
				},
				 */
			},
		});
	}
}
