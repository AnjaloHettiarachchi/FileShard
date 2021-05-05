import { Service, ServiceBroker } from "moleculer";
import DBConnection from "../mixins/db.mixin";

export default class FileChunkDuplicateService extends Service {
	private readonly SERVICE_NAME = "fileChunkDuplicate";

	public constructor(broker: ServiceBroker) {
		super(broker);

		const DBMixin = new DBConnection(this.SERVICE_NAME).connectToMasterDb();

		this.parseServiceSchema({
			name: this.SERVICE_NAME,
			mixins: [DBMixin],
		});
	}
}
