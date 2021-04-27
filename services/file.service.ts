import { types } from "util";
import Moleculer, { Service, ServiceBroker } from "moleculer";
import { ServiceConfig } from "../utils/configs/service.config";
import { CACHE_KEYS } from "../constants";
import { WorkerNode } from "../utils/models/workerNode";
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
	params: { node: NodeItem };
}

export default class FileService extends Service {
	private readonly SERVICE_NAME = "file";
	private readonly workerNode: WorkerNode = null;
	private readonly serviceConfig: ServiceConfig = null;

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
					async handler(): Promise<string> {
						return this.ActionHello();
					},
				},
				info: {
					rest: "GET /info",
					async handler() {
						return this.ActionGetInfo();
					},
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
				"bully.election"(ctx: EventContext) {
					this.handleBullyElectionEvent(ctx);
				},
				"bully.alive"(ctx: EventContext) {
					this.handleBullyAliveEvent(ctx);
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

	public async ActionGetInfo() {
		const myNodeID = this.broker.nodeID;
		const serviceName = this.SERVICE_NAME;
		const currentServiceMasterNode = await this.serviceConfig.get(
			CACHE_KEYS.SERVICE_CURRENT_MASTER
		);
		const nodeConfigMaster = this.workerNode.coordinatorNodeId;
		const otherNodes = this.workerNode.otherWorkerNodeIds;
		const amIMaster = this.workerNode.selfCoordinatorState;

		return {
			NodeID: myNodeID,
			ServiceName: serviceName,
			ServiceMasterNodeID: currentServiceMasterNode,
			NodeConfigMasterNodeID: nodeConfigMaster,
			otherNodes,
			amIMaster,
		};
	}

	private async initService() {
		try {
			await this.initOtherNodeList();
			await this.initServiceNodeConfig();
		} catch (e) {
			throw new MoleculerServerError(
				"Created function failed. Error: " + e.message
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

	private addToCurrentNodeList(nodeItem: NodeItem) {
		const nodeIds = this.workerNode.otherWorkerNodeIds;

		nodeItem.services.forEach(service => {
			if (
				service.name === this.SERVICE_NAME &&
				!(nodeIds && nodeIds.includes(nodeItem.id))
			) {
				nodeIds.push(nodeItem.id);
			}
		});
	}

	private removeFromCurrentNodeList(nodeItem: NodeItem) {
		const otherNodes = this.workerNode.otherWorkerNodeIds;

		nodeItem.services.forEach(service => {
			if (
				service.name === this.SERVICE_NAME &&
				!(otherNodes && otherNodes.includes(nodeItem.id))
			) {
				otherNodes.splice(otherNodes.indexOf(nodeItem.id));
			}
		});
	}

	private async initOtherNodeList() {
		await this.broker
			.call("$node.list", { withServices: true })
			.then((res: [NodeItem]) => {
				res.forEach(item => {
					this.addToCurrentNodeList(item);
				});
			});
	}

	private async handleBullyElectionEvent(ctx: EventContext) {
		//
	}

	private async handleBullyAliveEvent(ctx: EventContext) {
		//
	}

	private async handleBullyVictoryEvent(ctx: EventContext) {
		//
	}

	private async handleNodeDisconnectEvent(ctx: EventContext) {
		const masterNodeId = this.workerNode.coordinatorNodeId;
		const isElectionAlreadyStarted = this.workerNode.selfElectionState;

		if (ctx.params.node.id === masterNodeId && !isElectionAlreadyStarted) {
			// Elect master
		} else {
			// Remove Master and wait for new coordinator.
			this.removeFromCurrentNodeList(ctx.params.node);
		}
	}
}
