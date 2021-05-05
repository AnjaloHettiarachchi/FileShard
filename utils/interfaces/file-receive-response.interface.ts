import { FileDocument } from "./file-document.interface";
import { FileChunkDocument } from "./file-chunk-document.interface";
import { FileChunkDuplicateDocument } from "./file-chunk-duplicate-document.interface";

export interface FileReceiveResponse {
	success: boolean;
	file: FileDocument;
	chunk: FileChunkDocument;
	duplicate: FileChunkDuplicateDocument;
}
