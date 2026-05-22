import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { runSeoSync } from "../lib/integrations/seo-sync";
const ORG_ID = "cmo402dwz0002c93lf3okkgi0";
(async () => {
  console.log("Running SEO sync for TC...");
  const start = Date.now();
  const result = await runSeoSync(ORG_ID);
  console.log(`Done in ${((Date.now()-start)/1000).toFixed(1)}s`);
  console.log(JSON.stringify(result, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
