const getServiceCacheKey = (serviceName: string, genericCacheKey: string) =>
	`${serviceName.toUpperCase()}_SERVICE.${genericCacheKey}`;

const getNodeCacheKey = (nodeId: string, genericCacheKey: string) =>
	`${nodeId.toUpperCase()}.${genericCacheKey}`;

export { getServiceCacheKey, getNodeCacheKey };
