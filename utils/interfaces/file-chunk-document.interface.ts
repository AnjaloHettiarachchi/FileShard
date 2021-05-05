import { FileDocument } from "./file-document.interface";

export interface FileChunkDocument {
	_id?: string;
	name: string;
	location: string;
	md5sum: string;
	size: number;
	file: string | FileDocument;
}
