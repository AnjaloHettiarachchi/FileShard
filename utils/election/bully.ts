import { WorkerNode } from "../models/workerNode";
import { parseComparableNodeId } from "../common";
import { ServiceConfig } from "../configs/service.config";
import { ACTION_NAMES, CACHE_KEYS, EVENT_NAMES } from "../../constants";
import { NodeInfoResponse } from "../interfaces/nodeInfoResponse.interface";
import { BullyMsg } from "../interfaces/bullyMsg.interface";
import { BullyMsgContext } from "../interfaces/bullyMsgContext.interface";

export class Bully {
	private readonly selfNode: WorkerNode;
	private readonly serviceConfig: ServiceConfig;

	public constructor(selfNode: WorkerNode, serviceConfig: ServiceConfig) {
		this.selfNode = selfNode;
		this.serviceConfig = serviceConfig;
	}

	public async startElectionProcess() {
		const isAnyElectionAlreadyStarted = await this.getIsAnyElectionAlreadyStarted();
		if (
			!isAnyElectionAlreadyStarted &&
			this.selfNode.coordinatorNodeId === ""
		) {
			this.prepareNodeConfigForElection();
			const isSelfHighestNode = await this.getIsSelfHighestNode();
			if (isSelfHighestNode) {
				return await this.appointSelfAsCoordinator();
			}

			const responses = await this.sendElectionMsgToHigherNodes();
			const isAnyAlive = responses.some(
				response => response.message === "alive"
			);

			if (!isAnyAlive) {
				return await this.appointSelfAsCoordinator();
			}
		}
	}

	public async handleElectionMsg(ctx: BullyMsgContext) {
		const senderNodeId = ctx.params.senderNodeId;
		const selfNodeId = this.selfNode.nodeId;
		if (
			parseComparableNodeId(senderNodeId) <
			parseComparableNodeId(selfNodeId)
		) {
			// Start election of my own
			await this.startElectionProcess();
			return {
				message: "alive",
				senderNodeId: this.selfNode.nodeId,
			} as BullyMsg;
		}
	}

	public handleVictoryMsg(ctx: BullyMsgContext) {
		if (ctx.nodeID !== this.selfNode.nodeId) {
			this.selfNode.serviceBroker.logger.debug(
				`Received Victory from ${ctx.nodeID} node...`
			);
			this.updateSelfConfigWithNewCoordinator(ctx.nodeID, false);
		}
	}

	private prepareNodeConfigForElection() {
		this.selfNode.serviceBroker.logger.debug(
			`Node ${this.selfNode.nodeId} started election...`
		);
		this.selfNode.coordinatorNodeId = "";
		this.selfNode.selfCoordinatorState = false;
		this.selfNode.selfElectionState = "running";
	}

	private async getIsAnyElectionAlreadyStarted(): Promise<boolean> {
		const promises = [];
		const otherNodeIds = await this.selfNode.getOtherNodeIds();
		for (const nodeId of otherNodeIds) {
			const res: Promise<NodeInfoResponse> = this.selfNode.serviceBroker.call(
				ACTION_NAMES.FILE_NODE_INFO,
				null,
				{
					nodeID: nodeId,
				}
			);
			promises.push(res);
		}

		const nodeInfoList = await Promise.all(promises);
		return nodeInfoList.some(
			node => node.nodeDetails.selfElectionState === "running"
		);
	}

	private async appointSelfAsCoordinator() {
		const promises = [];
		promises.push(this.broadcastVictoryMsg());
		promises.push(
			this.updateServiceConfigForNewCoordinator(this.selfNode.nodeId)
		);
		this.updateSelfConfigWithNewCoordinator(this.selfNode.nodeId, true);
		await Promise.all(promises);
	}

	private updateSelfConfigWithNewCoordinator(
		nodeId: string,
		isSelf: boolean
	) {
		this.selfNode.serviceBroker.logger.debug(
			`selfConfig >>> nodeId: ${nodeId}`
		);
		this.selfNode.coordinatorNodeId = nodeId;
		this.selfNode.selfElectionState = "ready";
		this.selfNode.selfCoordinatorState = isSelf;
	}

	private async updateServiceConfigForNewCoordinator(coordinatorId: string) {
		return this.serviceConfig.set(
			CACHE_KEYS.SERVICE_CURRENT_MASTER,
			coordinatorId
		);
	}

	private async sendElectionMsgToHigherNodes(): Promise<BullyMsg[]> {
		const promises = [];
		const higherNodeIds = await this.getHigherNodeIdsThanSelf();
		for (const nodeId of higherNodeIds) {
			const res = this.sendElectionMsg(nodeId);
			promises.push(res);
		}

		return await Promise.all(promises);
	}

	private async broadcastVictoryMsg() {
		return await this.selfNode.serviceBroker.broadcast(
			EVENT_NAMES.BULLY_VICTORY,
			{
				message: "victory",
				senderNodeId: this.selfNode.nodeId,
			} as BullyMsg,
			this.selfNode.serviceName
		);
	}

	private async sendElectionMsg(nodeId: string): Promise<BullyMsg> {
		return await this.selfNode.serviceBroker.call(
			ACTION_NAMES.FILE_BULLY_ELECTION,
			{
				message: "election",
				senderNodeId: this.selfNode.nodeId,
			} as BullyMsg,
			{ nodeID: nodeId, fallbackResponse: { message: null } }
		);
	}

	private async getHigherNodeIdsThanSelf(): Promise<string[]> {
		const otherNodeIds = await this.selfNode.getOtherNodeIds();
		return otherNodeIds.filter(
			nodeId =>
				parseComparableNodeId(nodeId) >
				parseComparableNodeId(this.selfNode.nodeId)
		);
	}

	private async getIsSelfHighestNode(): Promise<boolean> {
		const otherNodeIds = await this.selfNode.getOtherNodeIds();
		return otherNodeIds.every(
			nodeId =>
				parseComparableNodeId(nodeId) <
				parseComparableNodeId(this.selfNode.nodeId)
		);
	}
}
