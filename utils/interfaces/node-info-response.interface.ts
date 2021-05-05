export interface NodeInfoResponse {
	serviceDetails: {
		serviceName: string;
		serviceMasterNodeId: string;
	};
	nodeDetails: {
		nodeId: string;
		coordinatorNodeId: string;
		selfCoordinatorState: boolean;
		selfElectionState: "ready" | "running" | "waiting";
	};
}
