import { Service, ServiceBroker } from "moleculer";
import DBConnection from "../mixins/db.mixin";

export default class FileChunkDuplicateService extends Service {
	private readonly SERVICE_NAME = "fileChunkDuplicate";
	private readonly COLLECTION_NAME = "file_chunk_duplicates";

	public constructor(broker: ServiceBroker) {
		super(broker);
		const DbMixin = new DBConnection(this.COLLECTION_NAME).connect();

		this.parseServiceSchema({
			name: this.SERVICE_NAME,
			mixins: [DbMixin],
		});
	}
}
