// require("ts-node/register");
import "dotenv/config";
import app from "./src/app";

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`서버 가동 중 ${port}`);
});
