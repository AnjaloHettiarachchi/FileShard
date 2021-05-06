import path from "path";
import * as fs from "fs";
import mkdirp from "mkdirp";
// @ts-ignore
import splitFile from "split-file";
import md5File from "md5-file";
import mime from "mime-types";
import { ServiceBroker } from "moleculer";
import lo_ from "lodash";
import { EventContext } from "../../interfaces/event-context.interface";
import { FileShardLogger } from "../../logger";
import { WorkerNode } from "../../models/worker-node";
import { FileReceiveResponse } from "../../interfaces/file-receive-response.interface";
import { FileDocument } from "../../interfaces/file-document.interface";
import { FileChunkDocument } from "../../interfaces/file-chunk-document.interface";
import { FileChunkDuplicateDocument } from "../../interfaces/file-chunk-duplicate-document.interface";

const tempDir = path.join("/app", "dist", "public", "__temp");
const chunkDir = path.join("/app", "dist", "public", "__chunks");
const duplicateDir = path.join("/app", "dist", "public", "__duplicates");
const downloadDir = path.join("/app", "dist", "public");

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

	private static getUniqueName(originalName: string): string {
		return `${Date.now()}__${originalName}`;
	}

	public handleFileReceive(
		ctx: EventContext,
		receiveType: "upload" | "chunk" | "duplicate"
	): Promise<FileReceiveResponse> {
		const originalName = ctx.meta.filename;
		const uniqueFilename = FileHandler.getUniqueName(originalName);

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
						this.logger.log(`Uploaded file stored in ${filePath}`);

						// Calculate MD5 Hash for whole file.
						const md5sum = md5File.sync(filePath);

						// Save file record to 'master_file' collection...
						const fileDoc: FileDocument = await this.serviceBroker.call(
							"file.create",
							{
								name: path.parse(filePath).name,
								originalName,
								type: mime.lookup(path.parse(filePath).base),
								md5sum,
								size: fs.statSync(filePath).size,
							} as FileDocument
						);

						// Send chunks to slaves...
						const currentAvailableNodeIds = await this.workerNode.getOtherNodeIds();
						const numberOfChunks =
							currentAvailableNodeIds.length + 1;
						const fileChunks = await splitFile.splitFile(
							filePath,
							numberOfChunks
						);

						currentAvailableNodeIds.unshift(
							this.serviceBroker.nodeID
						);

						// Send chunks...
						const chunkRes: FileReceiveResponse[] = await this.sendChunksToAvailableSlaveNodes(
							fileDoc._id,
							fileChunks,
							currentAvailableNodeIds
						);

						for (const doc of chunkRes) {
							const otherDocs = chunkRes.filter(v => v !== doc);
							await this.sendDuplicatesToAvailableSlaveNodes(
								doc.chunk,
								otherDocs.map(docx => docx.chunk),
								fileChunks
							);
						}

						resolve({
							success: true,
							file: fileDoc,
						} as FileReceiveResponse);
						break;
					}

					case "chunk": {
						// File uploaded successfully.
						this.logger.log(`Chunk file stored in ${filePath}`);

						// Calculate MD5 Hash for whole file.
						const md5sum = md5File.sync(filePath);

						// Save file chunk record to 'file_chunks' collection...
						const fileChunkDoc: FileChunkDocument = await this.serviceBroker.call(
							"fileChunk.create",
							{
								name: path.parse(filePath).base,
								location: ctx.broker.nodeID,
								md5sum,
								size: fs.statSync(filePath).size,
								file: ctx.meta.fileDocId,
							} as FileChunkDocument
						);

						resolve({
							success: true,
							chunk: fileChunkDoc,
						} as FileReceiveResponse);
						break;
					}

					case "duplicate": {
						// File uploaded successfully.
						this.logger.log(`Duplicate file stored in ${filePath}`);

						// Calculate MD5 Hash for whole file.
						const md5sum = md5File.sync(filePath);

						// Save file chunk duplicate record to 'file_chunks_duplicates' collection...
						const fileChunkDuplicateDoc: FileChunkDuplicateDocument = await this.serviceBroker.call(
							"fileChunkDuplicate.create",
							{
								name: path.parse(filePath).base,
								location: ctx.broker.nodeID,
								md5sum,
								size: fs.statSync(filePath).size,
								chunk: ctx.meta.fileChunkId,
							} as FileChunkDuplicateDocument
						);

						resolve({
							success: true,
							duplicate: fileChunkDuplicateDoc,
						} as FileReceiveResponse);
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

	public async handleFileDownload(ctx: EventContext): Promise<any> {
		const fileId = ctx.params.id;
		const downloadLinkList: string[] = [];

		const dirPath = path.join(
			downloadDir,
			FileHandler.getUniqueName("chunks")
		);
		mkdirp.sync(dirPath);

		// Get chunk records...
		const chunkDocs: FileChunkDocument[] = await this.serviceBroker.call(
			"fileChunk.find",
			{ query: { file: fileId } }
		);

		// Check if all chunk holders are alive
		const allAvailableNodes = await this.workerNode.getAllNodeIds();
		const isEveryChunkHolderAlive = chunkDocs.every(chunk =>
			allAvailableNodes.includes(chunk.location)
		);

		if (!isEveryChunkHolderAlive) {
			// Look for duplicate location for the specific chunk
			const unavailableChunks = chunkDocs.filter(
				chunk => !allAvailableNodes.includes(chunk.location)
			);

			// Remove unavailable chunks from main chunk list...
			lo_.remove(chunkDocs, chunk => unavailableChunks.includes(chunk));

			// Get duplicates for unavailable chunks and added stored to the link list
			const duplicateStoredPaths = await this.findAndRetrieveDuplicateOfChunks(
				unavailableChunks,
				dirPath
			);

			downloadLinkList.push(...duplicateStoredPaths);
		}

		// Go ahead and retrieve from those locations
		return new Promise((resolve, reject) => {
			for (const doc of chunkDocs) {
				const node = doc.location;
				const previousChecksum = doc.md5sum;
				const filePath = path.join(dirPath, doc.name);

				const writeStream = fs.createWriteStream(filePath);

				this.serviceBroker
					.call(
						"file.chunk.retrieve",
						{
							filename: doc.name,
						},
						{ nodeID: node }
					)
					.then((stream: { pipe: (s: fs.WriteStream) => void }) => {
						writeStream.on("error", err => {
							reject(err);
						});

						writeStream.on("close", async () => {
							this.logger.log(
								`Done retrieving chunk and stored in ${filePath}`
							);

							const newChecksum = md5File.sync(filePath);

							if (newChecksum === previousChecksum) {
								this.logger.log(
									`File's integrity check is valid in path ${filePath}`
								);
								downloadLinkList.push(filePath);
							} else {
								// Integrity check failed. Look for duplicates
								this.logger.log(
									`File's integrity check failed in path ${filePath}`
								);
								const duplicateStoredPaths = await this.findAndRetrieveDuplicateOfChunks(
									[doc],
									dirPath
								);
								downloadLinkList.push(...duplicateStoredPaths);
							}

							if (!--chunkDocs.length) {
								resolve({
									chunks: downloadLinkList,
								});
							}
						});

						stream.pipe(writeStream);
					});
			}
		});
	}

	public async handleChunkRetrieve(ctx: EventContext) {
		const filePath = path.join(chunkDir, ctx.params.filename);
		return fs.createReadStream(filePath);
	}

	public async handleDuplicateRetrieve(ctx: EventContext) {
		const filePath = path.join(duplicateDir, ctx.params.filename);
		return fs.createReadStream(filePath);
	}

	private async findAndRetrieveDuplicateOfChunks(
		missingChunks: FileChunkDocument[],
		chunkStorePath: string
	): Promise<string[]> {
		return new Promise(async (resolve, reject) => {
			const linkList: string[] = [];

			for (const chunkDoc of missingChunks) {
				const duplicateDocs: FileChunkDuplicateDocument[] = await this.serviceBroker.call(
					"fileChunkDuplicate.find",
					{ query: { chunk: chunkDoc._id } }
				);

				// Get a random duplicate from list...
				const randomNode =
					duplicateDocs[lo_.random(0, duplicateDocs.length - 1)]
						.location;

				const previousChecksum = chunkDoc.md5sum;
				const filePath = path.join(chunkStorePath, chunkDoc.name);

				const writeStream = fs.createWriteStream(filePath);

				this.serviceBroker
					.call(
						"file.duplicate.retrieve",
						{
							filename: chunkDoc.name,
						},
						{ nodeID: randomNode }
					)
					.then((stream: { pipe: (s: fs.WriteStream) => void }) => {
						writeStream.on("error", err => {
							reject(err);
						});

						writeStream.on("close", async () => {
							this.logger.log(
								`Done retrieving duplicate chunk and stored in ${filePath}`
							);

							const newChecksum = md5File.sync(filePath);

							if (newChecksum === previousChecksum) {
								this.logger.log(
									`File's integrity check is valid in path ${filePath}`
								);
								linkList.push(filePath);
							} else {
								// Integrity check failed. Look for duplicates
								this.logger.log(
									`File's integrity check failed in path ${filePath}`
								);
								const duplicateStoredPaths = await this.findAndRetrieveDuplicateOfChunks(
									[chunkDoc],
									chunkStorePath
								);
								linkList.push(...duplicateStoredPaths);
							}

							if (!--missingChunks.length) {
								resolve(linkList);
							}
						});

						stream.pipe(writeStream);
					});
			}
		});
	}

	private async sendChunksToAvailableSlaveNodes(
		fileDocId: string,
		chunks: string[],
		availableNodes: string[]
	): Promise<FileReceiveResponse[]> {
		const promises: any[] = [];

		for (const chunk of chunks) {
			const index = chunks.indexOf(chunk);
			const chunkBasename = path.parse(chunk).base;
			const currentNodeId = availableNodes[index];

			const readStream = fs.createReadStream(chunk);

			// Send chunk to node
			promises.push(
				this.serviceBroker.call("file.chunk.store", readStream, {
					nodeID: currentNodeId,
					meta: { filename: chunkBasename, fileDocId },
				})
			);
		}

		return Promise.all(promises);
	}

	private async sendDuplicatesToAvailableSlaveNodes(
		fileChunkDoc: FileChunkDocument,
		otherChunkDocs: FileChunkDocument[],
		chunkList: string[]
	) {
		const promises: any[] = [];

		const chunkPath = path.join(tempDir, fileChunkDoc.name);
		const chunkStoredNode = fileChunkDoc.location;
		const chunksExceptCurrent = chunkList.filter(
			chunk => chunk !== chunkPath
		);

		for (const duplicate of chunksExceptCurrent) {
			const nodeId = chunkStoredNode;
			const duplicateBasename = path.parse(duplicate).base;
			const currentChunkDocId = otherChunkDocs.find(
				doc => doc.name === duplicateBasename
			)._id;

			const readStream = fs.createReadStream(duplicate);

			promises.push(
				this.serviceBroker.call("file.duplicate.store", readStream, {
					nodeID: nodeId,
					meta: {
						filename: duplicateBasename,
						fileChunkId: currentChunkDocId,
					},
				})
			);
		}

		return Promise.all(promises);
	}
}
