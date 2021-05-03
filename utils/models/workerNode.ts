/* eslint-disable @typescript-eslint/explicit-member-accessibility,no-underscore-dangle */
import Moleculer, { ServiceBroker } from "moleculer";

interface NodeItem {
	id: string;
	services?: [
		{
			name: string;
		}
	];
}

export class WorkerNode {
	private readonly _nodeId: string;
	private readonly _serviceName: string;
	private readonly _serviceBroker: ServiceBroker;
	private _coordinatorNodeId: string;
	private _selfCoordinatorState: boolean;
	private _selfElectionState: "ready" | "running" | "waiting";

	public constructor(
		nodeId: string,
		serviceName: string,
		serviceBroker: ServiceBroker,
		coordinatorNodeId: string = "",
		selfCoordinatorState: boolean = false,
		selfElectionState: "ready" | "running" | "waiting" = "ready"
	) {
		this._nodeId = nodeId;
		this._serviceName = serviceName;
		this._serviceBroker = serviceBroker;
		this._coordinatorNodeId = coordinatorNodeId;
		this._selfCoordinatorState = selfCoordinatorState;
		this._selfElectionState = selfElectionState;
	}

	get nodeId(): string {
		return this._nodeId;
	}

	get serviceName(): string {
		return this._serviceName;
	}

	get serviceBroker(): Moleculer.ServiceBroker {
		return this._serviceBroker;
	}

	get coordinatorNodeId(): string {
		return this._coordinatorNodeId;
	}

	set coordinatorNodeId(value: string) {
		this._coordinatorNodeId = value;
	}

	get selfCoordinatorState(): boolean {
		return this._selfCoordinatorState;
	}

	set selfCoordinatorState(value: boolean) {
		this._selfCoordinatorState = value;
	}

	get selfElectionState(): "ready" | "running" | "waiting" {
		return this._selfElectionState;
	}

	set selfElectionState(value: "ready" | "running" | "waiting") {
		this._selfElectionState = value;
	}

	public async getOtherNodeIds(): Promise<string[]> {
		const nodeIds = Array<string>();
		const nodeList: NodeItem[] = await this._serviceBroker.call(
			"$node.list",
			{
				withServices: true,
				onlyAvailable: true,
			}
		);

		for (const node of nodeList) {
			const sameServiceNodes = node.services.some(
				service => service.name === this._serviceName
			);
			if (sameServiceNodes && node.id !== this._nodeId) {
				nodeIds.push(node.id);
			}
		}

		return nodeIds;
	}
}
