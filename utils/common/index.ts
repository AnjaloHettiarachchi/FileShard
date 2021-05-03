const getServiceCacheKey = (serviceName: string, genericCacheKey: string) =>
	`${serviceName.toUpperCase()}_SERVICE.${genericCacheKey}`;

const getNodeCacheKey = (nodeId: string, genericCacheKey: string) =>
	`${nodeId.toUpperCase()}.${genericCacheKey}`;

const parseComparableNodeId = (fullNodeId: string): bigint =>
	BigInt(fullNodeId.split("-", 2)[1]);

export { getServiceCacheKey, getNodeCacheKey, parseComparableNodeId };
