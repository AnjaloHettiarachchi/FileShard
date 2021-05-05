import { FileChunkDocument } from "./file-chunk-document.interface";

export interface FileChunkDuplicateDocument {
	_id: string;
	name: string;
	location: string;
	md5sum: string;
	size: number;
	chunk: string | FileChunkDocument;
}
