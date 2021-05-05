import path from "path";
import * as fs from "fs";
import mkdirp from "mkdirp";
// @ts-ignore
import splitFile from "split-file";
import { ServiceBroker } from "moleculer";
import { EventContext } from "../../interfaces/event-context.interface";
import { FileShardLogger } from "../../logger";
import { WorkerNode } from "../../models/worker-node";

const tempDir = path.join("/app", "dist", "public", "__temp");
const chunkDir = path.join("/app", "dist", "public", "__chunks");
const duplicateDir = path.join("/app", "dist", "public", "__duplicates");

export default class FileHandler {
	private readonly workerNode: WorkerNode;
	private readonly serviceBroker: ServiceBroker;
	private readonly logger: FileShardLogger;

	public constructor(workerNode: WorkerNode, serviceBroker: ServiceBroker) {
		this.workerNode = workerNode;
		this.serviceBroker = serviceBroker;
		this.logger = new FileShardLogger(
			"info",
			serviceBroker.logger,
			"FileHandler"
		);

		mkdirp.sync(tempDir);
		mkdirp.sync(chunkDir);
		mkdirp.sync(duplicateDir);
	}

	private static getUniqueFilename(originalName: string): string {
		return `${Date.now()}__${originalName}`;
	}

	public handleFileReceive(
		ctx: EventContext,
		receiveType: "upload" | "chunk" | "duplicate"
	) {
		const originalName = ctx.meta.filename;
		const uniqueFilename = FileHandler.getUniqueFilename(originalName);

		return new Promise((resolve, reject) => {
			let filePath: string;
			if (receiveType === "upload") {
				filePath = path.join(tempDir, uniqueFilename);
			} else if (receiveType === "chunk") {
				filePath = path.join(chunkDir, originalName);
			} else {
				filePath = path.join(duplicateDir, originalName);
			}
			const writeStream = fs.createWriteStream(filePath);

			writeStream.on("close", async () => {
				switch (receiveType) {
					case "upload": {
						// File uploaded successfully.
						// Save file record to Master DB...
						this.logger.log(`Uploaded file stored in ${filePath}`);

						// Send chunks to slaves...
						const currentAvailableNodeIds = await this.workerNode.getOtherNodeIds();
						const numberOfChunks =
							currentAvailableNodeIds.length + 1;
						const fileChunks = await splitFile.splitFile(
							filePath,
							numberOfChunks
						);

						// Send chunks...
						await this.sendChunksToAvailableSlaveNodes(
							fileChunks,
							currentAvailableNodeIds
						);

						// Resolve response
						resolve({ success: true, meta: ctx.meta });
						break;
					}

					case "chunk": {
						// File uploaded successfully.
						this.logger.log(`Chunk file stored in ${filePath}`);
						resolve({ success: true, meta: ctx.meta });
						break;
					}

					case "duplicate": {
						// File uploaded successfully.
						this.logger.log(`Duplicate file stored in ${filePath}`);
						resolve({ success: true, meta: ctx.meta });
						break;
					}

					default: {
						reject(Error("Invalid file receive type."));
					}
				}
			});

			writeStream.on("error", err => {
				reject(err);
			});

			ctx.params.pipe(writeStream);
		});
	}

	private async sendChunksToAvailableSlaveNodes(
		fileChunks: string[],
		availableNodes: string[]
	) {
		const firstChunk = fileChunks.shift();
		const firstChunkBasename = path.parse(firstChunk).base;
		fs.copyFileSync(firstChunk, path.join(chunkDir, firstChunkBasename));

		await this.sendDuplicatesToAvailableSlaveNodes(fileChunks, "self");

		const promises: any[] = [];

		for (const chunk of fileChunks) {
			const index = fileChunks.indexOf(chunk);
			const chunkBasename = path.parse(chunk).base;
			const currentNodeId = availableNodes[index];

			await this.sendDuplicatesToAvailableSlaveNodes(
				fileChunks,
				currentNodeId,
				chunk,
				firstChunk
			);

			const readStream = fs.createReadStream(chunk);
			// Send chunk to node

			promises.push(
				this.serviceBroker.call("file.chunk.store", readStream, {
					nodeID: currentNodeId,
					meta: { filename: chunkBasename },
				})
			);
		}

		return await Promise.all(promises);
	}

	private async sendDuplicatesToAvailableSlaveNodes(
		list: string[],
		nodeId: "self" | string,
		exclude?: string,
		include?: string
	) {
		let duplicateList = list;

		if (exclude) {
			duplicateList = list.filter(item => item !== exclude);
		}

		if (include && !duplicateList.includes(include)) {
			duplicateList.push(include);
		}

		if (nodeId === "self") {
			return duplicateList.forEach(item => {
				this.logger.log(`node: ${nodeId} file: ${item}`);
				fs.copyFileSync(
					item,
					path.join(duplicateDir, path.parse(item).base)
				);
			});
		}

		const promises: any[] = [];

		for (const duplicate of duplicateList) {
			this.logger.log(`node: ${nodeId} file: ${duplicate}`);

			const readStream = fs.createReadStream(duplicate);

			promises.push(
				this.serviceBroker.call("file.duplicate.store", readStream, {
					nodeID: nodeId,
					meta: { filename: path.parse(duplicate).base },
				})
			);
		}

		return await Promise.all(promises);
	}
}
