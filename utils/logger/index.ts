import Moleculer, { LoggerInstance } from "moleculer";
import MoleculerError = Moleculer.Errors.MoleculerError;

export class FileShardLogger {
	private readonly logLevel: "info" | "debug";
	private readonly loggerInstance: LoggerInstance;
	private readonly logPrefix: string;

	public constructor(
		logLevel: "info" | "debug",
		loggerInstance: LoggerInstance,
		logPrefix: string
	) {
		this.logLevel = logLevel;
		this.loggerInstance = loggerInstance;
		this.logPrefix = logPrefix;
	}

	public log(message: string, prefix?: string) {
		switch (this.logLevel) {
			case "debug": {
				this.loggerInstance.debug(
					`${prefix ? prefix : this.logPrefix} >>> ${message}`
				);
				break;
			}

			case "info": {
				this.loggerInstance.info(
					`${prefix ? prefix : this.logPrefix} >>> ${message}`
				);
				break;
			}

			default: {
				throw new MoleculerError(
					"FileShardLogger: Unidentified log level."
				);
			}
		}
	}
}
