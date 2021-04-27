/* eslint-disable @typescript-eslint/explicit-member-accessibility,no-underscore-dangle */
export class WorkerNode {
	private readonly nodeId: string;

	public constructor(
		nodeId: string,
		coordinatorNodeId?: string,
		otherWorkerNodeIds: string[] = [],
		selfElectionState: boolean = false,
		selfCoordinatorState: boolean = false
	) {
		this.nodeId = nodeId;
		this._coordinatorNodeId = coordinatorNodeId;
		this._otherWorkerNodeIds = otherWorkerNodeIds;
		this._selfElectionState = selfElectionState;
		this._selfCoordinatorState = selfCoordinatorState;
	}

	private _coordinatorNodeId: string;

	get coordinatorNodeId(): string {
		return this._coordinatorNodeId;
	}

	set coordinatorNodeId(value: string) {
		this._coordinatorNodeId = value;
	}

	private _otherWorkerNodeIds: string[];

	get otherWorkerNodeIds(): string[] {
		return this._otherWorkerNodeIds;
	}

	set otherWorkerNodeIds(value: string[]) {
		this._otherWorkerNodeIds = value;
	}

	private _selfElectionState: boolean;

	get selfElectionState(): boolean {
		return this._selfElectionState;
	}

	set selfElectionState(value: boolean) {
		this._selfElectionState = value;
	}

	private _selfCoordinatorState: boolean;

	get selfCoordinatorState(): boolean {
		return this._selfCoordinatorState;
	}

	set selfCoordinatorState(value: boolean) {
		this._selfCoordinatorState = value;
	}
}
