/* eslint-disable @typescript-eslint/explicit-member-accessibility,no-underscore-dangle */
export class WorkerNode {
	private readonly _nodeId: string;
	private _otherWorkerNodeIds: string[];
	private _selfElectionState: boolean;
	private _selfCoordinatorState: boolean;
	private _coordinatorNodeId: string;

	public constructor(
		nodeId: string,
		coordinatorNodeId?: string,
		otherWorkerNodeIds: string[] = [],
		selfElectionState: boolean = false,
		selfCoordinatorState: boolean = false
	) {
		this._nodeId = nodeId;
		this._coordinatorNodeId = coordinatorNodeId;
		this._otherWorkerNodeIds = otherWorkerNodeIds;
		this._selfElectionState = selfElectionState;
		this._selfCoordinatorState = selfCoordinatorState;
	}

	get nodeId(): string {
		return this._nodeId;
	}

	get coordinatorNodeId(): string {
		return this._coordinatorNodeId;
	}

	set coordinatorNodeId(value: string) {
		this._coordinatorNodeId = value;
	}

	get otherWorkerNodeIds(): string[] {
		return this._otherWorkerNodeIds;
	}

	set otherWorkerNodeIds(value: string[]) {
		this._otherWorkerNodeIds = value;
	}

	get selfElectionState(): boolean {
		return this._selfElectionState;
	}

	set selfElectionState(value: boolean) {
		this._selfElectionState = value;
	}

	get selfCoordinatorState(): boolean {
		return this._selfCoordinatorState;
	}

	set selfCoordinatorState(value: boolean) {
		this._selfCoordinatorState = value;
	}
}
