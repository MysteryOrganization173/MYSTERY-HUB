/** Spreadsheet formula protection and RFC4180 field quoting. */
export function safeCsvCell(val:unknown):string {
 if(val===null||val===undefined)return '""';let str=String(val).trim();
 if(/^[=+\-@\t\r]/.test(str))str="'"+str;
 return '"'+str.replace(/"/g,'""')+'"';
}
