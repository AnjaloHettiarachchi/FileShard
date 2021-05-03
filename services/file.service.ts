import { types } from "util";
import Moleculer, { Service, ServiceBroker } from "moleculer";
import { ServiceConfig } from "../utils/configs/service.config";
import { CACHE_KEYS } from "../constants";
import { WorkerNode } from "../utils/models/workerNode";
import { Bully } from "../utils/election/bully";
import { NodeInfoResponse } from "../utils/interfaces/nodeInfoResponse.interface";
import { EventContext } from "../utils/interfaces/eventContext.interface";
import MoleculerServerError = Moleculer.Errors.MoleculerServerError;
import MoleculerError = Moleculer.Errors.MoleculerError;

export default class FileService extends Service {
	private readonly SERVICE_NAME = "file";
	private readonly workerNode: WorkerNode;
	private readonly serviceConfig: ServiceConfig;
	private readonly bully: Bully;

	public constructor(broker: ServiceBroker) {
		super(broker);
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

		this.parseServiceSchema({
			name: this.SERVICE_NAME,
			actions: {
				"hello": {
					rest: "GET /hello",
					async handler(): Promise<string> {
						return this.ActionHello();
					},
				},
				"node.info": {
					rest: "GET /node/info",
					async handler() {
						return this.ActionNodeInfo();
					},
				},
				"bully.election": {
					rest: "GET /bully/election",
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

	public async handleBullyVictoryEvent(ctx: EventContext) {
		return this.bully.handleVictoryMsg(ctx);
	}

	private async initService() {
		try {
			await this.serviceConfig
				.get(CACHE_KEYS.SERVICE_CURRENT_MASTER)
				.then(async res => {
					if (types.isNativeError(res)) {
						throw new MoleculerError(
							"Error occurred while getting Master Node from ServiceConfig."
						);
					}

					// Service doesn't have elected a Master yet.
					if (res === null) {
						await this.serviceConfig.set(
							CACHE_KEYS.SERVICE_CURRENT_MASTER,
							this.broker.nodeID
						);

						this.workerNode.coordinatorNodeId = this.broker.nodeID;
						this.workerNode.selfCoordinatorState = true;
						//	Service already have a Master.
					} else {
						this.workerNode.coordinatorNodeId = res as string;
						this.workerNode.selfCoordinatorState =
							res === this.broker.nodeID;
					}
				});
		} catch (e) {
			throw new MoleculerServerError(
				"Node started lifecycle function failed. Error: " + e.message
			);
		}
	}

	private async handleNodeDisconnectEvent(ctx: EventContext): Promise<void> {
		const disconnectedNodeId = ctx.params.node.id;

		if (disconnectedNodeId === this.workerNode.coordinatorNodeId) {
			// Disconnected node is the Coordinator. Elect a new one...
			this.workerNode.coordinatorNodeId = "";
			await this.bully.startElectionProcess();
		}
	}
}
