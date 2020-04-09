//import * as sqlite3 from 'sqlite3';
import { Data } from './Data' ;
import { UtilsSQLite } from './UtilsSQLite';

const COL_ID = "id";
const COL_NAME = "name";
const COL_VALUE = "value";
const fs: any = window['fs' as any];
const path: any = window['path' as any];

export class StorageDatabaseHelper {
    private _db: any;
    private _dbName: string;
    private _tableName: string;
//    private _secret: string = "";
    private _utils: UtilsSQLite;

    constructor() {
        this._utils = new UtilsSQLite();
    }

    public openStore(dbName:string,tableName:string): Promise<boolean> {
        return new Promise(  (resolve) => {
            let ret: boolean = false;
            this._db = this._utils.connection(dbName,false/*,this._secret*/);
            if(this._db !== null) {
                this._createTable(tableName);
                this._dbName = dbName;
                this._tableName = tableName;
                ret = true;    
            }
            resolve(ret);
        });
    }
    private _createTable(tableName:string) {
        const CREATE_STORAGE_TABLE = "CREATE TABLE IF NOT EXISTS " + tableName +
                "(" +
                COL_ID + " INTEGER PRIMARY KEY AUTOINCREMENT," + // Define a primary key
                COL_NAME + " TEXT NOT NULL UNIQUE," +
                COL_VALUE + " TEXT" +
                ")";
        try {
            this._db.run(CREATE_STORAGE_TABLE, this._createIndex.bind(this,tableName));   
        }
        catch(e) {
            console.log('Error: in createTable ',e)
        }
    }
    private _createIndex(tableName:string) {
        const idx: string = `index_${tableName}_on_${COL_NAME}`;
        const CREATE_INDEX_NAME = "CREATE INDEX IF NOT EXISTS " + idx + " ON " + tableName +
        " (" + COL_NAME  + ")";        
        try {
            this._db.run(CREATE_INDEX_NAME);    
        }
        catch(e) {
            console.log('Error: in createIndex ',e)
        }
    }

    public setTable(tableName:string): Promise<boolean> {
        return new Promise( async (resolve) => {
            let ret: boolean = false;
            this._db = this._utils.getWritableDatabase(this._dbName/*,this._secret*/);
            try {
                this._createTable(tableName);
                this._tableName = tableName;
                ret = true;
                console.log('create table successfull ',this._tableName)
            }
            catch(e) {
                console.log('Error: in createTable ',e);
            }
            finally {
                this._db.close();
                resolve(ret);
            }
        });
    }
    // Insert a data into the database

    public set(data:Data): Promise<boolean> {
        return new Promise( async (resolve) => {
            const db: any = this._utils.getWritableDatabase(this._dbName/*,this._secret*/);
            // Check if data.name does not exist otherwise update it
            const res:Data = await this.get(data.name);
            if(res.id != null) {
                // exists so update it
                const resUpd = await this.update(data);
                db.close();
                resolve(resUpd);
            } else {
                // does not exist add it
                const DATA_INSERT: string = `INSERT INTO "${this._tableName}" 
                ("${COL_NAME}", "${COL_VALUE}") 
                VALUES (?, ?)`;
                db.run(DATA_INSERT,[data.name,data.value],(err:Error) => {
                    if(err) {
                        console.log('Data INSERT: ',err.message);
                        db.close();
                        resolve(false);
                    } else {
                        db.close();
                        resolve(true);
                    }
                });
            }

        });
    }

    // get a Data
    public get(name : string) : Promise<Data> {
        return new Promise( (resolve) => {
            let data: Data = null;
            const db: any = this._utils.getReadableDatabase(this._dbName/*,this._secret*/);
            const DATA_SELECT_QUERY: string = "SELECT * FROM "+ this._tableName +
                    " WHERE " + COL_NAME + " = '" + name + "'";
            db.all(DATA_SELECT_QUERY, (err:Error,rows:any) => {
                if(err) {
                    data = new Data();
                    data.id = null;
                    db.close();
                    resolve(data);
                } else {
                    data = new Data();
                    if( rows.length >=1 ) {
                        data = rows[0];
                    } else {
                        data.id = null;
                    }
                    db.close();
                    resolve(data);
                }
            });
        });
    }
    // update a Data
    public update(data:Data): Promise<boolean> {
        return new Promise( (resolve) => {
            const db: any = this._utils.getWritableDatabase(this._dbName/*,this._secret*/);
            const DATA_UPDATE: string = `UPDATE "${this._tableName}" 
            SET "${COL_VALUE}" = ? WHERE "${COL_NAME}" = ?`;
            db.run(DATA_UPDATE,[data.value,data.name],(err: Error) => {
                if(err) {
                    console.log('Data UPDATE: ',err.message);
                    db.close();
                    resolve(false);
                } else {
                    db.close();
                    resolve(true);
                }
            });

        });
    }
    // isKey exists
    public iskey(name: string): Promise<boolean> {
        return new Promise( async (resolve) => {
            const res:Data = await this.get(name);
            if(res.id != null) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    }
    // remove a key
    public remove(name: string): Promise<boolean> {
        return new Promise( async (resolve) => {
            const res:Data = await this.get(name);
            if(res.id != null) {
                const db: any = this._utils.getWritableDatabase(this._dbName/*,this._secret*/);
                const DATA_DELETE: string = `DELETE FROM "${this._tableName}" 
                WHERE "${COL_NAME}" = ?`;
                db.run(DATA_DELETE,name,(err:Error) => {
                    if(err) {
                        console.log('Data DELETE: ',err.message);
                        db.close();
                        resolve(false);
                    } else {
                        db.close();
                        resolve(true);
                    }
                });
                    
            } else {
                console.log('Error:REMOVE key does not exist')
                resolve(false);
            }
        });
    }
    // remove all keys 
    public clear(): Promise<boolean> {
        return new Promise( async (resolve) => {
            const db: any = this._utils.getWritableDatabase(this._dbName/*,this._secret*/);
            const DATA_DELETE: string = `DELETE FROM "${this._tableName}"`; 
            db.run(DATA_DELETE,[],(err: Error) => {
                if(err) {
                    console.log('Data CLEAR: ',err.message);
                    db.close();
                    resolve(false);
                } else {
                    // set back the key primary index to 0
                    const DATA_UPDATE: string = `UPDATE SQLITE_SEQUENCE 
                    SET SEQ = ? `;
                    db.run(DATA_UPDATE,0,(err: Error) => {
                        if(err) {
                            console.log('Data UPDATE SQLITE_SEQUENCE: ',err.message);
                            db.close();
                            resolve(false);
                        } else {
                            db.close();
                            resolve(true);
                        }
                    });
                }
            });
        });
    }
    public keys(): Promise<Array<string>> {
        return new Promise( (resolve) => {
            const db: any = this._utils.getReadableDatabase(this._dbName/*,this._secret*/);
            const DATA_SELECT_KEYS: string = `SELECT "${COL_NAME}" FROM "${this._tableName}"`;
            db.all(DATA_SELECT_KEYS, (err: Error,rows:any) => {
                if(err) {
                    db.close();
                    resolve([]);
                } else {
                    let arKeys: Array<string> = [];
                    for( let i:number = 0; i < rows.length; i++) {
                        arKeys = [...arKeys,rows[i].name];
                        if(i === rows.length - 1 ) {
                            db.close();
                            resolve(arKeys);
                        }
                    }                    
                }
            });
        });

    }
    public values(): Promise<Array<string>> {
        return new Promise( (resolve) => {
            const db: any = this._utils.getReadableDatabase(this._dbName/*,this._secret*/);
            const DATA_SELECT_VALUES: string = `SELECT "${COL_VALUE}" FROM "${this._tableName}"`;
            db.all(DATA_SELECT_VALUES, (err:Error,rows:any) => {
                if(err) {
                    db.close();
                    resolve([]);
                } else {
                    let arValues: Array<string> = [];
                    for( let i:number = 0; i < rows.length; i++) {
                        arValues = [...arValues,rows[i].value];
                        if(i === rows.length - 1 ) {
                            db.close();
                            resolve(arValues);
                        }
                    }                    
                }
            });
        });

    }
    public keysvalues(): Promise<Array<Data>> {
        return new Promise( (resolve) => {
            const db: any = this._utils.getReadableDatabase(this._dbName/*,this._secret*/);
            const DATA_SELECT_KEYSVALUES: string = `SELECT "${COL_NAME}" , "${COL_VALUE}" FROM "${this._tableName}"`;
            db.all(DATA_SELECT_KEYSVALUES, (err:Error,rows:any) => {
                if(err) {
                    db.close();
                    resolve([]);
                } else {
                    db.close();
                    resolve(rows);
                }
            });
        });
    }

    public deleteStore(dbName:string): Promise<boolean> {
        return new Promise( (resolve) => {
            let ret: boolean = false;
            const dbPath = path.join(this._utils.pathDB,dbName);
            try {
                fs.unlinkSync(dbPath);
                //file removed
                ret = true;
              } catch(e) {
                console.log("Error: in deleteStore");
              }
            resolve(ret); 
        });
    }

}
