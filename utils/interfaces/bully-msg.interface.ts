export interface BullyMsg {
	message: "alive" | "election" | "victory" | null;
	senderNodeId?: string;
}
