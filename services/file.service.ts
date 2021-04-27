import { types } from "util";
import Moleculer, { Context, Service, ServiceBroker } from "moleculer";
import { ServiceConfig } from "../utils/configs/service.config";
import { CACHE_KEYS } from "../constants";
import { WorkerNode } from "../utils/models/workerNode";
import {
	findHigherNodeId,
	findHighestNodeId,
	findNodeIdsHigherThanSelf,
} from "../utils/common";
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
					handler: async (): Promise<string> => this.ActionHello(),
				},
				info: {
					rest: "GET /info",
					handler: async () => this.ActionGetInfo(),
				},
				electionStart: {
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
		const nodeID = this.broker.nodeID;
		const serviceName = this.SERVICE_NAME;
		const serviceMasterNodeId = await this.serviceConfig.get(
			CACHE_KEYS.SERVICE_CURRENT_MASTER
		);
		const nodeDetails = this.workerNode;

		return {
			nodeID,
			serviceName,
			serviceMasterNodeId,
			nodeDetails,
		};
	}

	public async ActionElection(ctx: Context) {
		const selfId = this.broker.nodeID;
		if (findHigherNodeId(selfId, ctx.nodeID) === selfId) {
			await this.startPolling();
			return { message: "ok" };
		}

		return { message: "nok" };
	}

	private async startPolling() {
		this.workerNode.coordinatorNodeId = "";
		this.workerNode.selfCoordinatorState = false;
		this.workerNode.selfElectionState = true;

		const nodeIdsHigherThanSelf = findNodeIdsHigherThanSelf(
			this.broker.nodeID,
			this.workerNode.otherWorkerNodeIds
		);

		for (const nodeId of nodeIdsHigherThanSelf) {
			const allResponses: string[] = [];
			await this.broker
				.call("file.election", null, { nodeID: nodeId })
				.then((res: { message: "ok" | "nok" }) => {
					allResponses.push(res.message);
				});

			if (allResponses.indexOf("ok") !== -1) {
				this.waitForVictoryMsg();
			} else {
				await this.appointSelfAsCoordinator(this.broker.nodeID);
			}
		}
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
				!nodeIds.includes(nodeItem.id)
			) {
				nodeIds.push(nodeItem.id);
			}
		});
	}

	private removeFromCurrentNodeList(nodeItem: NodeItem) {
		const otherNodes = this.workerNode.otherWorkerNodeIds;
		if (otherNodes.includes(nodeItem.id)) {
			otherNodes.splice(otherNodes.indexOf(nodeItem.id), 1);
		}
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

	private async handleElectionVictoryEvent(ctx: EventContext) {
		this.workerNode.coordinatorNodeId = ctx.nodeID;
		this.workerNode.selfElectionState = false;
		this.workerNode.selfCoordinatorState =
			ctx.nodeID === this.broker.nodeID;
	}

	private async handleNodeDisconnectEvent(ctx: EventContext) {
		// Remove node from the list.
		const masterNodeId = this.workerNode.coordinatorNodeId;
		this.removeFromCurrentNodeList(ctx.params.node);

		if (ctx.params.node.id === masterNodeId) {
			// Disconnected node is the coordinator. Elect new one.
			const allElectionStates: boolean[] = [];
			for (const node of this.workerNode.otherWorkerNodeIds) {
				await this.broker
					.call("file.info", null, { nodeID: node })
					.then((res: { nodeDetails: WorkerNode }) => {
						allElectionStates.push(
							res.nodeDetails.selfElectionState
						);
					});
			}
			const isElectionAlreadyStarted =
				allElectionStates.indexOf(true) !== -1;
			const selfNodeId = this.broker.nodeID;

			const allNodes = this.workerNode.otherWorkerNodeIds.concat([
				selfNodeId,
			]);

			// Elect a new coordinator.
			if (findHighestNodeId(allNodes) === selfNodeId) {
				// I'm the new coordinator.
				await this.appointSelfAsCoordinator(selfNodeId);
			} else if (isElectionAlreadyStarted) {
				// Wait for a new coordinator.
				this.waitForVictoryMsg();
			} else {
				await this.startPolling();
			}
		}
	}

	private waitForVictoryMsg() {
		this.workerNode.coordinatorNodeId = "";
		this.workerNode.selfCoordinatorState = false;
		this.workerNode.selfElectionState = false;
	}

	private async appointSelfAsCoordinator(selfNodeId: string) {
		await this.broker.broadcast(
			"election.victory",
			{ nodeId: selfNodeId },
			this.SERVICE_NAME
		);
		this.workerNode.coordinatorNodeId = selfNodeId;
		this.workerNode.selfCoordinatorState = true;
		this.workerNode.selfElectionState = false;
	}
}
