import test from "node:test";
import assert from "node:assert/strict";
import {parseDirectory,searchDirectory} from "../lib/directory.mjs";
test("directory excludes funds, test symbols and non-common instruments",()=>{
 const rows=parseDirectory("Symbol|Security Name|Test Issue|ETF\nABC|ABC Common Stock|N|N\nTEST|Test Inc|Y|N\nFUND|ETF|N|Y\nABCW|ABC Warrants|N|N\nABCU|ABC Units|N|N",true);
 assert.deepEqual(rows,[{symbol:"ABC",name:"ABC Common Stock",exchange:"NASDAQ"}]);
 assert.throws(()=>parseDirectory("bad"));
 assert.equal(searchDirectory(rows,"common").length,1);assert.equal(searchDirectory(rows,"abc","NYSE").length,0);
});
