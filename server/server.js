
import express from "express";
import cors from "cors";
import fs from "fs";
import crypto from "crypto";

const app = express();
const PORT = 8787;
const DB = "./codes.json";

app.use(cors());
app.use(express.json());

function readDB(){
  return JSON.parse(fs.readFileSync(DB,"utf8"));
}

function writeDB(data){
  fs.writeFileSync(DB,JSON.stringify(data,null,2));
}

app.post("/redeem",(req,res)=>{
  const code = String(req.body.code || "").trim().toUpperCase();

  if(!code){
    return res.status(400).json({
      ok:false,
      error:"MISSING CODE"
    });
  }

  const db = readDB();
  const item = db.codes[code];

  if(!item){
    return res.status(404).json({
      ok:false,
      error:"INVALID CODE"
    });
  }

  if(item.used){
    return res.status(409).json({
      ok:false,
      error:"CODE ALREADY USED"
    });
  }

  item.used = true;
  item.usedAt = new Date().toISOString();

  const token = crypto.randomBytes(24).toString("hex");

  writeDB(db);

  return res.json({
    ok:true,
    token
  });
});

app.listen(PORT,()=>{
  console.log("FTS SERVER RUNNING ON http://localhost:"+PORT);
});
