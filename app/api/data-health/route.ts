import { identity, privateJson, failure, HttpError } from "@/lib/server";
import { feedResource } from "@/lib/data-feed";
import { dataHealth, validHealthIndex } from "@/lib/data-health.mjs";
export async function GET() {
  try {
    await identity();
    const resource=await feedResource("index.json",validHealthIndex);
    if (!resource.data) throw new HttpError(503,"The data health feed is unavailable and no validated cached copy exists. Health is unknown; try again later.");
    return privateJson({...dataHealth(resource.data),delivery:resource.delivery});
  } catch(e) {return failure(e);}
}
