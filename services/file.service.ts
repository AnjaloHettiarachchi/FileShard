import { types } from "util";
import Moleculer, { Context, Service, ServiceBroker } from "moleculer";
import { ServiceConfig } from "../utils/configs/service.config";
import { CACHE_KEYS } from "../constants";
import { WorkerNode } from "../utils/models/workerNode";
import { Bully } from "../utils/election/bully";
import MoleculerServerError = Moleculer.Errors.MoleculerServerError;
import MoleculerError = Moleculer.Errors.MoleculerError;

interface NodeItem {
	id: string;
	services?: [
		{
			name: string;
		}
	];
}

interface EventContext extends Moleculer.Context {
	params: { node: NodeItem; nodeId?: string };
}

export default class FileService extends Service {
	private readonly SERVICE_NAME = "file";
	private readonly workerNode: WorkerNode;
	private readonly serviceConfig: ServiceConfig;
	private bully: Bully;

	public constructor(broker: ServiceBroker) {
		super(broker);
		this.workerNode = new WorkerNode(this.broker.nodeID);
		this.serviceConfig = new ServiceConfig(
			this.SERVICE_NAME,
			this.broker.cacher
		);

		this.parseServiceSchema({
			name: this.SERVICE_NAME,
			actions: {
				hello: {
					rest: "GET /",
					handler: async (): Promise<string> => this.ActionHello(),
				},
				info: {
					rest: "GET /info",
					handler: async () => this.ActionGetInfo(),
				},
				status: {
					rest: "GET /status",
					handler: async () => this.ActionGetStatus(),
				},
				election: {
					rest: "GET /election",
					handler: async ctx => this.ActionElection(ctx),
				},
			},
			dependencies: ["$node"],
			events: {
				"$node.connected"(ctx: { params: { node: NodeItem } }) {
					this.handleNodeConnectedEvent(ctx.params.node);
				},
				"$node.disconnected"(ctx: EventContext) {
					this.handleNodeDisconnectEvent(ctx);
				},
				"election.victory"(ctx: EventContext) {
					this.handleElectionVictoryEvent(ctx);
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

	public async ActionGetInfo() {
		const serviceName = this.SERVICE_NAME;
		const serviceMasterNodeId = await this.serviceConfig.get(
			CACHE_KEYS.SERVICE_CURRENT_MASTER
		);
		const nodeDetails = this.workerNode;

		return {
			serviceName,
			serviceMasterNodeId,
			nodeDetails,
		};
	}

	public async ActionGetStatus() {
		const nodeDetails = this.workerNode;
		const serviceName = this.SERVICE_NAME;
		const serviceMasterNodeId = await this.serviceConfig.get(
			CACHE_KEYS.SERVICE_CURRENT_MASTER
		);

		return {
			nodeDetails,
			serviceDetails: {
				serviceName,
				serviceMasterNodeId,
			},
		};
	}

	public async ActionElection(ctx: Context) {
		return this.bully.handleElectionMsg(ctx.nodeID);
	}

	private async initService() {
		try {
			await this.initOtherNodeList();
			await this.initServiceNodeConfig();
		} catch (e) {
			throw new MoleculerServerError(
				"Service initialization failed. Error: " + e.message
			);
		}
	}

	private async initServiceNodeConfig() {
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
					this.metadata.masterNodeId = this.broker.nodeID;

					this.workerNode.coordinatorNodeId = this.broker.nodeID;
					this.workerNode.selfCoordinatorState = true;
					//	Service already have a Master.
				} else {
					this.workerNode.coordinatorNodeId = res as string;
					this.workerNode.selfCoordinatorState =
						res === this.broker.nodeID;
				}
			});
	}

	private handleNodeConnectedEvent(nodeItem: NodeItem): void {
		this.addToCurrentNodeList(nodeItem);
	}

	private async initOtherNodeList() {
		return this.broker
			.call("$node.list", { withServices: true })
			.then((res: [NodeItem]) => {
				res.forEach(item => {
					this.addToCurrentNodeList(item);
				});
			});
	}

	private addToCurrentNodeList(nodeItem: NodeItem) {
		const nodeIds = this.workerNode.otherWorkerNodeIds;
		const isSameService = nodeItem.services.some(
			service => service.name === this.SERVICE_NAME
		);
		if (!nodeIds.includes(nodeItem.id) && isSameService) {
			nodeIds.push(nodeItem.id);
		}
	}

	private handleElectionVictoryEvent(ctx: EventContext) {
		this.bully.handleVictoryMsg(ctx.nodeID);
	}

	private async handleNodeDisconnectEvent(ctx: EventContext) {
		// Remove node from the list.
		const masterNodeId = this.workerNode.coordinatorNodeId;
		this.removeFromCurrentNodeList(ctx.params.node);

		if (ctx.params.node.id === masterNodeId) {
			// Disconnected node is the coordinator. Elect new one.
			this.bully = new Bully(
				this.SERVICE_NAME,
				this.broker,
				this.workerNode
			);
			await this.bully.selfStartElection();
		}
	}

	private removeFromCurrentNodeList(nodeItem: NodeItem) {
		const otherNodes = this.workerNode.otherWorkerNodeIds;
		if (otherNodes.includes(nodeItem.id)) {
			otherNodes.splice(otherNodes.indexOf(nodeItem.id), 1);
			this.logger.debug(
				`${nodeItem.id} removed from other node id list.`
			);
		}
	}
}
