require("ts-node/register");
require("dotenv").config();
const app = require("./src/app");

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`서버 가동 중 ${port}`);
});
