import { Service, ServiceBroker } from "moleculer";
import Connection from "../mixins/db.mixin";

export default class FileChunkService extends Service {
	private readonly SERVICE_NAME = "fileChunk";
	private readonly COLLECTION_NAME = "file_chunks";

	public constructor(broker: ServiceBroker) {
		super(broker);
		const DbMixin = new Connection(this.COLLECTION_NAME).connect();

		this.parseServiceSchema({
			name: this.SERVICE_NAME,
			mixins: [DbMixin],
			settings: {
				populates: {
					file: "file.get",
				},
			},
		});
	}
}
