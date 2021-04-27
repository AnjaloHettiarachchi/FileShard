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
) => {
	const higherNodeIds: string[] = [];

	try {
		if (typeof otherNodeIds !== "undefined" && otherNodeIds.length > 0) {
			otherNodeIds.forEach(otherNodeId => {
				if (findHigherNodeId(selfNodeId, otherNodeId) !== selfNodeId) {
					higherNodeIds.push(otherNodeId);
				}
			});
		}
	} catch (e) {
		throw new Error(`Finding higher NodeIDs failed. Error: ${e.message}`);
	}

	return higherNodeIds;
};

const findHighestNodeId = (nodeIds: string[]) => {
	let highest = nodeIds.shift();
	for (const nodeId of nodeIds) {
		if (findHigherNodeId(highest, nodeId) !== highest) {
			highest = nodeId;
		}
	}
	return highest;
};

export {
	getServiceCacheKey,
	getNodeCacheKey,
	findHigherNodeId,
	findNodeIdsHigherThanSelf,
	findHighestNodeId,
};
