import { WorkerNode } from "../models/workerNode";

export class Bully {
	private readonly clusterNodes: WorkerNode[] = [];

	public constructor(clusterNodes: WorkerNode[]) {
		this.clusterNodes = clusterNodes;
	}

	private isReadyForElection(): boolean {
		const coordinatorStates: boolean[] = [];
		const electionsStates: boolean[] = [];

		this.clusterNodes.forEach(node => {
			coordinatorStates.push(node.selfCoordinatorState);
			electionsStates.push(node.selfElectionState);
		});

		return !(
			coordinatorStates.includes(true) || electionsStates.includes(true)
		);
	}
}
