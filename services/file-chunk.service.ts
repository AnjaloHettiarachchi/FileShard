import { Service, ServiceBroker } from "moleculer";
import DbService from "moleculer-db";

export default class FileChunkService extends Service {
	private readonly SERVICE_NAME = "fileChunk";

	public constructor(broker: ServiceBroker) {
		super(broker);

		this.parseServiceSchema({
			name: this.SERVICE_NAME,
			mixins: [DbService],
		});
	}
}
