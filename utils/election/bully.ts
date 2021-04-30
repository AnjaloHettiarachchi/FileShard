import { ServiceBroker } from "moleculer";
import { WorkerNode } from "../models/workerNode";
import { findHigherNodeId, parseComparableNodeId } from "../common";
import { CACHE_KEYS } from "../../constants";
import { FileShardLogger } from "../logger";
import { ServiceConfig } from "../configs/service.config";

interface StatusResponse {
	nodeDetails: WorkerNode;
	serviceDetails: {
		serviceName: string;
		serviceMasterNodeId: string;
	};
}

interface ElectionResponse {
	message: "ok";
}

export class Bully {
	private readonly EVENT_NAME_ELECTION_VICTORY = "election.victory";
	private readonly ACTION_NAME_FILE_ELECTION = "file.election";
	private readonly ACTION_NAME_FILE_STATUS = "file.status";
	private readonly serviceBroker: ServiceBroker;
	private readonly selfNode: WorkerNode;

	private readonly loggerService: FileShardLogger;
	private readonly serviceConfig: ServiceConfig;

	public constructor(
		serviceName: string,
		serviceBroker: ServiceBroker,
		selfNode: WorkerNode
	) {
		this.serviceBroker = serviceBroker;
		this.selfNode = selfNode;
		this.loggerService = new FileShardLogger(
			"info",
			serviceBroker.logger,
			"BULLY"
		);
		this.serviceConfig = new ServiceConfig(
			serviceName,
			serviceBroker.cacher
		);
	}

	public selfStartElection(): Promise<void> {
		this.loggerService.log("Trying to start election on my own...");
		if (this.checkIfSelfHighest()) {
			this.loggerService.log(
				"I'm the highest node alive. Appoint myself as coordinator..."
			);
			return this.appointSelfAsCoordinator();
		}

		this.loggerService.log(
			"I'm not the highest node. Trying to broadcast election msg..."
		);
		return this.broadcastElectionMsgToHigherNodes();
	}

	public async handleElectionMsg(
		senderNodeId: string
	): Promise<ElectionResponse | null> {
		const selfNodeId = this.selfNode.nodeId;
		this.loggerService.log(
			`Received an election msg from ${senderNodeId}. Trying to handle...`
		);

		if (findHigherNodeId(selfNodeId, senderNodeId) === selfNodeId) {
			this.loggerService.log(
				`My ID ${selfNodeId} higher than election msg sender's ID ${senderNodeId}. Send ack and trying to start election on my own...`
			);
			await this.selfStartElection();
			return { message: "ok" };
		}

		this.loggerService.log(
			`My ID ${selfNodeId} lower than election msg sender's ID ${senderNodeId}. Send nothing back...`
		);
		return null;
	}

	public handleVictoryMsg(senderNodeId: string): void {
		this.loggerService.log(
			`Received a Victory msg from ${senderNodeId}. Saving sender as my coordinator...`
		);
		this.selfNode.selfElectionState = false;
		this.selfNode.coordinatorNodeId = senderNodeId;
		this.selfNode.selfCoordinatorState =
			senderNodeId === this.selfNode.nodeId;
	}

	private checkIfSelfHighest(): boolean {
		const nodeIdList = this.selfNode.otherWorkerNodeIds;
		const selfNodeId = this.selfNode.nodeId;

		return nodeIdList.every(
			nodeId =>
				parseComparableNodeId(selfNodeId) >
				parseComparableNodeId(nodeId)
		);
	}

	private waitForVictory(): void {
		this.loggerService.log("Waiting for a Victory msg...");
		this.selfNode.coordinatorNodeId = "";
		this.selfNode.selfCoordinatorState = false;
		this.selfNode.selfElectionState = false;
	}

	private isAnyOngoingElection(): boolean {
		const nodeIdList = this.selfNode.otherWorkerNodeIds;

		this.loggerService.log("Checking if there is any ongoing election...");
		return !nodeIdList.every(async nodeId => {
			const resp: StatusResponse = await this.serviceBroker.call(
				this.ACTION_NAME_FILE_STATUS,
				null,
				{
					nodeID: nodeId,
				}
			);
			return resp.nodeDetails.selfElectionState === false;
		});
	}

	private async appointSelfAsCoordinator(): Promise<void> {
		this.loggerService.log("Appoint myself as the coordinator...");
		this.selfNode.coordinatorNodeId = this.selfNode.nodeId;
		this.selfNode.selfCoordinatorState = true;
		this.selfNode.selfElectionState = false;

		await this.serviceConfig.set(
			CACHE_KEYS.SERVICE_CURRENT_MASTER,
			this.selfNode.nodeId
		);
		await this.serviceBroker.broadcast(this.EVENT_NAME_ELECTION_VICTORY);
	}

	private async broadcastElectionMsgToHigherNodes(): Promise<void> {
		this.loggerService.log("Trying to broadcast Election msg...");
		if (!this.isAnyOngoingElection()) {
			this.loggerService.log(
				"There is no ongoing election. Proceed with sending Election msg..."
			);
			this.selfNode.coordinatorNodeId = "";
			this.selfNode.selfCoordinatorState = false;
			this.selfNode.selfElectionState = true;

			const nodeIdList = this.selfNode.otherWorkerNodeIds;
			const selfNodeId = this.selfNode.nodeId;

			const nodeIdsHigherThanSelf = nodeIdList.filter(
				nodeId =>
					parseComparableNodeId(nodeId) >
					parseComparableNodeId(selfNodeId)
			);

			const noHigherNodeResponded = nodeIdsHigherThanSelf.every(
				async nodeId => {
					const res: ElectionResponse | null = await this.serviceBroker.call(
						this.ACTION_NAME_FILE_ELECTION,
						null,
						{
							nodeID: nodeId,
						}
					);
					return res === null;
				}
			);

			if (noHigherNodeResponded) {
				this.loggerService.log(
					"No higher node responded for Election msg. Trying to appointing self as coordinator..."
				);
				return this.appointSelfAsCoordinator();
			}

			this.loggerService.log(
				"At least one higher node responded to Election msg. Stop election and waiting..."
			);
			return this.waitForVictory();
		}

		this.loggerService.log(
			"There is an ongoing election. Stop proceeding with sending Election msg..."
		);
		return this.waitForVictory();
	}
}
