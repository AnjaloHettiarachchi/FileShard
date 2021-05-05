import Moleculer, { Service, ServiceBroker } from "moleculer";
import { ServiceConfig } from "../utils/configs/service.config";
import { CACHE_KEYS } from "../constants";
import { WorkerNode } from "../utils/models/worker-node";
import { Bully } from "../utils/handlers/election/bully";
import { NodeInfoResponse } from "../utils/interfaces/node-info-response.interface";
import { EventContext } from "../utils/interfaces/event-context.interface";
import DBConnection from "../mixins/db.mixin";
import FileHandler from "../utils/handlers/file";
import MoleculerServerError = Moleculer.Errors.MoleculerServerError;

export default class FileService extends Service {
	private readonly SERVICE_NAME = "file";
	private readonly COLLECTION_NAME = "files";

	private readonly workerNode: WorkerNode;
	private readonly serviceConfig: ServiceConfig;
	private readonly fileHandler: FileHandler;
	private readonly bully: Bully;

	public constructor(broker: ServiceBroker) {
		super(broker);
		const DBMixin = new DBConnection(this.COLLECTION_NAME).connect();

		this.workerNode = new WorkerNode(
			this.broker.nodeID,
			this.SERVICE_NAME,
			this.broker
		);
		this.serviceConfig = new ServiceConfig(
			this.SERVICE_NAME,
			this.broker.cacher
		);
		this.bully = new Bully(this.workerNode, this.serviceConfig);
		this.fileHandler = new FileHandler(this.workerNode, this.broker);

		// @ts-ignore
		this.parseServiceSchema({
			name: this.SERVICE_NAME,
			mixins: [DBMixin],
			actions: {
				"hello": {
					rest: "GET /hello",
					handler: async () => await this.ActionHello(),
				},
				"upload": {
					handler: async ctx => await this.ActionUpload(ctx),
				},
				"chunk.retrieve": {
					rest: "GET /chunk/retrieve",
					handler: async ctx => await this.ActionChunkRetrieve(ctx),
				},
				"chunk.store": {
					handler: async ctx => await this.ActionChunkStore(ctx),
				},
				"duplicate.retrieve": {
					rest: "GET /duplicate/retrieve",
					handler: async ctx =>
						await this.ActionDuplicateRetrieve(ctx),
				},
				"duplicate.store": {
					handler: async ctx => await this.ActionDuplicateStore(ctx),
				},
				"node.info": {
					rest: "GET /node/info",
					handler: () => this.ActionNodeInfo(),
				},
				"bully.election": {
					handler: async ctx => this.ActionBullyElection(ctx),
				},
			},
			dependencies: ["$node"],
			events: {
				"$node.disconnected"(ctx: EventContext) {
					this.handleNodeDisconnectEvent(ctx);
				},
				"bully.victory"(ctx: EventContext) {
					this.handleBullyVictoryEvent(ctx);
				},
			},
			methods: {
				initService: async () => {
					try {
						const masterNodeId = await this.serviceConfig.get(
							CACHE_KEYS.SERVICE_CURRENT_MASTER
						);

						// Service doesn't have elected a Master yet. Appoint self as Master...
						if (masterNodeId === null) {
							await this.serviceConfig.set(
								CACHE_KEYS.SERVICE_CURRENT_MASTER,
								this.broker.nodeID
							);

							this.workerNode.coordinatorNodeId = this.broker.nodeID;
							this.workerNode.selfCoordinatorState = true;
							//	Service already have a Master.
						} else {
							this.workerNode.coordinatorNodeId = masterNodeId as string;
							this.workerNode.selfCoordinatorState =
								masterNodeId === this.broker.nodeID;
						}
					} catch (e) {
						throw new MoleculerServerError(
							"Node started lifecycle function failed. Error: " +
								e.message
						);
					}
				},
			},
			hooks: {
				before: {
					create: [
						// @ts-ignore
						ctx => {
							ctx.params.createdAt = Date.now();
							ctx.params.updatedAt = Date.now();
							return ctx;
						},
					],
					update: [
						// @ts-ignore
						ctx => {
							ctx.params.updatedAt = Date.now();
							return ctx;
						},
					],
				},
			},
			started: async () => {
				await this.initService();
			},
		});
	}

	public ActionHello(): string {
		return `Hello from ${this.broker.nodeID}`;
	}

	public async ActionNodeInfo() {
		const serviceMasterNodeId = await this.serviceConfig.get(
			CACHE_KEYS.SERVICE_CURRENT_MASTER
		);
		const otherNodeIds = await this.workerNode.getOtherNodeIds();
		return {
			serviceDetails: {
				serviceName: this.SERVICE_NAME,
				serviceMasterNodeId,
			},
			nodeDetails: {
				nodeId: this.workerNode.nodeId,
				selfElectionState: this.workerNode.selfElectionState,
				coordinatorNodeId: this.workerNode.coordinatorNodeId,
				selfCoordinatorState: this.workerNode.selfCoordinatorState,
				otherNodeIds,
			},
		} as NodeInfoResponse;
	}

	public async ActionBullyElection(ctx: EventContext) {
		return await this.bully.handleElectionMsg(ctx);
	}

	public async ActionUpload(ctx: EventContext) {
		return await this.fileHandler.handleFileReceive(ctx, "upload");
	}

	public async ActionChunkRetrieve(ctx: EventContext) {
		//
	}

	public async ActionChunkStore(ctx: EventContext) {
		return await this.fileHandler.handleFileReceive(ctx, "chunk");
	}

	public async ActionDuplicateRetrieve(ctx: EventContext) {
		//
	}

	public async ActionDuplicateStore(ctx: EventContext) {
		return await this.fileHandler.handleFileReceive(ctx, "duplicate");
	}

	public async handleBullyVictoryEvent(ctx: EventContext) {
		return this.bully.handleVictoryMsg(ctx);
	}

	public async handleNodeDisconnectEvent(ctx: EventContext): Promise<void> {
		const disconnectedNodeId = ctx.params.node.id;

		if (disconnectedNodeId === this.workerNode.coordinatorNodeId) {
			// Disconnected node is the Coordinator. Elect a new one...
			this.workerNode.coordinatorNodeId = "";
			await this.bully.startElectionProcess();
		}
	}
}
