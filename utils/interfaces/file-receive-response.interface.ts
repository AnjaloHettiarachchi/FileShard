interface FileReceiveResponse {
	success: boolean;
	file: {
		name: string;
		type: string;
		md5sum: string;
		size: number;
	};
}
