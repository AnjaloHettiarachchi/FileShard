import { ActionEndpoint, Endpoint } from "moleculer";

const getServiceCacheKey = (serviceName: string, genericCacheKey: string) =>
	`${serviceName.toUpperCase()}_SERVICE.${genericCacheKey}`;

const getNodeCacheKey = (nodeId: string, genericCacheKey: string) =>
	`${nodeId.toUpperCase()}.${genericCacheKey}`;

const parseComparableNodeId = (nodeId: string): bigint =>
	BigInt(nodeId.split("-", 2)[1]).valueOf();

const findHigherNodeId = (
	firstNodeId: string,
	secondNodeId: string
): string => {
	try {
		return parseComparableNodeId(firstNodeId) >
			parseComparableNodeId(secondNodeId)
			? firstNodeId
			: secondNodeId;
	} catch (e) {
		throw new Error(`NodeID comparison failed. Error: ${e.message}`);
	}
};

const findNodeIdsHigherThanSelf = (
	selfNodeId: string,
	otherNodeIds: string[]
) => otherNodeIds.filter(nodeId => parseComparableNodeId(nodeId) > parseComparableNodeId(selfNodeId));

const findHighestNodeId = (nodeIds: string[]) => {
	let highest = nodeIds.shift();
	for (const nodeId of nodeIds) {
		if (findHigherNodeId(highest, nodeId) !== highest) {
			highest = nodeId;
		}
	}
	return highest;
};

const getServiceName = (endpoint: ActionEndpoint): string => endpoint.service.name;

const getMasterEndpoint = (
	masterNodeId: string,
	actionEndpoints: ActionEndpoint[]
): Endpoint => actionEndpoints.find(value => value.id === masterNodeId);

export {
	getServiceCacheKey,
	getNodeCacheKey,
	parseComparableNodeId,
	findHigherNodeId,
	findNodeIdsHigherThanSelf,
	findHighestNodeId,
	getServiceName,
	getMasterEndpoint,
};
