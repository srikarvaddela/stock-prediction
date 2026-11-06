"""Refresh eligible published models and settle earlier forecasts without republishing the app."""
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
import hashlib
import json
from .pipeline import train, VERSION

def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, allow_nan=False, separators=(",", ":")), encoding="utf-8")

def refresh(root=Path("feed")):
    today=datetime.now(timezone.utc).date()
    monday=today-timedelta(days=today.weekday())
    trained=skipped=0
    for path in sorted((root/"prices").glob("*.json")):
        raw=path.read_bytes(); data=json.loads(raw); symbol=data["symbol"]
        if symbol=="SPY": continue
        completed=[p for p in data["prices"] if p["date"]<monday.isoformat()]
        if len(completed)<180: skipped+=1; continue
        for horizon in (1,4):
            output=root/"models"/f"{symbol}-{horizon}.json"
            records_path=root/"records"/f"{symbol}-{horizon}.json"
            try: report=json.loads(output.read_text())
            except (OSError,ValueError): report=None
            try:
                if not report or report.get("asOf")!=completed[-1]["date"] or report.get("modelVersion")!=VERSION:
                    report,_=train(data["prices"],today,horizon)
                    report.update(symbol=symbol,dataset={"sha256":hashlib.sha256(raw).hexdigest(),"fetchedAt":data["fetchedAt"],"source":"Yahoo Finance daily prices aggregated to weeks"},usage="Automatically retrained after a new completed week; experimental research.")
                    save(output,report); trained+=1
                try: registry=json.loads(records_path.read_text())
                except (OSError,ValueError): registry={"symbol":symbol,"horizon":horizon,"records":[]}
                records=registry["records"]
                # Record only forecasts whose target has not already happened.
                if report["targetWeekEnding"]>today.isoformat() and not any(r["asOf"]==report["asOf"] for r in records):
                    records.append({"asOf":report["asOf"],"target":report["targetWeekEnding"],"createdAt":datetime.now(timezone.utc).isoformat(),"baseAdjusted":report["baseAdjusted"],"predictedReturn":report["expectedReturn"],"actualReturn":None,"modelId":report["modelId"]})
                for r in records:
                    if r.get("actualReturn") is not None or r["target"]>=monday.isoformat(): continue
                    target=date.fromisoformat(r["target"]); start=(target-timedelta(days=target.weekday())).isoformat()
                    observed=[p for p in completed if start<=p["date"]<=r["target"]]
                    base=next((p for p in completed if p["date"]==r["asOf"]),None)
                    if observed and base and r["createdAt"][:10]<observed[-1]["date"]:
                        # Re-read both adjusted endpoints together to avoid later split/dividend revisions.
                        r.update(actualReturn=observed[-1]["adjusted"]/base["adjusted"]-1,settledAt=today.isoformat(),observedDate=observed[-1]["date"])
                registry["records"]=records[-104:];save(records_path,registry)
            except (ValueError,KeyError,OverflowError) as e:
                print(f"{symbol} {horizon}w: no new model ({e})",flush=True);skipped+=1
        if (trained+skipped)%50==0: print(f"Models trained: {trained}; insufficient/invalid: {skipped}",flush=True)
    print(f"Finished: {trained} models trained; {skipped} insufficient histories",flush=True)

if __name__=="__main__": refresh()
