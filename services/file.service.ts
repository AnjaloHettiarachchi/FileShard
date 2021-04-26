import { types } from "util";
import Moleculer, { Service, ServiceBroker } from "moleculer";
import { NodeConfig } from "../utils/node.config";
import { ServiceConfig } from "../utils/service.config";
import { CACHE_KEYS } from "../constants";
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

export default class FileService extends Service {
	private currentOtherNodeList = Array<string>();
	private readonly SERVICE_NAME = "file";
	private readonly serviceConfig: ServiceConfig = null;
	private readonly nodeConfig: NodeConfig = null;

	public constructor(broker: ServiceBroker) {
		super(broker);
		this.serviceConfig = new ServiceConfig(
			this.SERVICE_NAME,
			this.broker.cacher
		);
		this.nodeConfig = new NodeConfig(
			this.broker.nodeID,
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
				"$node.disconnected"(ctx: { params: { node: NodeItem } }) {
					this.handleNodeDisconnectEvent(ctx.params.node);
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
		const nodeConfigMaster = await this.nodeConfig.get(
			CACHE_KEYS.NODE_CURRENT_MASTER
		);
		const otherNodes = this.currentOtherNodeList;
		const amIMaster = await this.nodeConfig.get(
			CACHE_KEYS.NODE_AM_I_MASTER
		);

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
					await this.nodeConfig.set(
						CACHE_KEYS.NODE_CURRENT_MASTER,
						this.broker.nodeID
					);

					await this.nodeConfig.set(
						CACHE_KEYS.NODE_AM_I_MASTER,
						true
					);
					//	Service already have a Master.
				} else {
					await this.nodeConfig.set(
						CACHE_KEYS.NODE_CURRENT_MASTER,
						res
					);
					await this.nodeConfig.set(
						CACHE_KEYS.NODE_AM_I_MASTER,
						res === this.broker.nodeID
					);
				}
			});
	}

	private handleNodeConnectedEvent(nodeItem: NodeItem): void {
		this.addToCurrentNodeList(nodeItem);
	}

	private addToCurrentNodeList(nodeItem: NodeItem) {
		nodeItem.services.forEach(service => {
			if (
				service.name === this.SERVICE_NAME &&
				!this.currentOtherNodeList.includes(nodeItem.id)
			) {
				this.currentOtherNodeList.push(nodeItem.id);
			}
		});
	}

	private removeFromCurrentNodeList(nodeItem: NodeItem) {
		nodeItem.services.forEach(service => {
			if (
				service.name === this.SERVICE_NAME &&
				!this.currentOtherNodeList.includes(nodeItem.id)
			) {
				this.currentOtherNodeList.splice(
					this.currentOtherNodeList.indexOf(nodeItem.id)
				);
			}
		});
	}

	private async initOtherNodeList() {
		await this.broker
			.call("$node.list", { withServices: true })
			.then((res: [NodeItem]) => {
				res.forEach(item => {
					this.handleNodeConnectedEvent(item);
				});
			});
	}

	private async handleNodeDisconnectEvent(disconnectedNode: NodeItem) {
		const masterNodeId = await this.nodeConfig.get(
			CACHE_KEYS.NODE_CURRENT_MASTER
		);

		if (disconnectedNode.id === masterNodeId) {
			this.logger.debug(
				"Master node has disconnected. Needs to elect a new leader."
			);
		} else {
			this.removeFromCurrentNodeList(disconnectedNode);
		}
	}
}
