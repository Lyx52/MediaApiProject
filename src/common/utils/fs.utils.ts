import * as fs from "fs";
import * as util from "util";

export abstract class FsUtils {
    private static _exists: any;
    public static get exists(): any {
        if (this._exists) return this._exists;
        this._exists = util.promisify(fs.exists);
        return this._exists;
    }
}